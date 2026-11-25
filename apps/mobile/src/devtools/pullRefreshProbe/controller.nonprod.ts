import { Platform } from 'react-native';
import { isNonPublicProductionEnv } from '@/constant';
import RNHelpers from '@/core/native/RNHelpers';
import type { PagerProbeRow } from './pagerTypes';
import { logger } from '@/utils/logger';
import {
  getEffectiveFileLoggingEnabled,
  setLocalFileLoggingEnabled,
} from '@/utils/logging/settings';
import type {
  PullRefreshProbeSnapshot,
  PullRefreshProbeScope,
  PullRefreshProbeUIRow,
} from './controller.prod';

export type {
  PullRefreshProbeSnapshot,
  PullRefreshProbeScope,
  PullRefreshProbeUIRow,
};

const PREFIX = '[PullRefreshProbe1130]';
const MAX_TTL = 300_000;
const UI_CAPACITY = 32768;
const PAGER_CAPACITY = 4096;
const PAGER_EVENTS = new Set([
  'drag-start',
  'release',
  'snap-start',
  'snap-cancelled',
  'ui-complete',
  'finalize',
  'command',
  'geometry',
  'publish-received',
  'publish-accepted',
  'publish-rejected',
  'business-begin',
  'business-end',
  'react-commit',
  'clock-anchor',
]);
const PAGER_ORIGINS = new Set([
  'gesture',
  'finalize',
  'ui-command',
  'js-command',
  'geometry',
]);
const METADATA_CAPACITY = 256;
// rabby-logger truncates every logged string at 500 chars (truncateText),
// so an envelope above that loses its rows. Keep batches well below it.
const MAX_ENTRY_LENGTH = 380;
const UI_PHASES = new Set([
  'sample',
  'gesture-start',
  'gesture-end',
  'gesture-finalize',
  'request-start',
  'request-finish',
  'loading',
  'unmount',
]);
const UI_SCOPES = new Set([
  'home-token-list',
  'home-defi-list',
  'home-nft-list',
]);
const NATIVE_EVENTS = new Set([
  'prepare',
  'adjust-before',
  'adjust-after',
  'scroll',
  'snapshot',
  'display',
  'container-before',
  'container-after',
  'size-before',
  'size-after',
]);
const STOP_REASONS = new Set([
  'expired',
  'cancel',
  'cancelled',
  'clear-session',
  'disabled',
  'replaced',
  'unmount',
]);

type SafeRecord = Record<string, unknown>;
type Session = {
  generation: number;
  runId: string;
  startedAt: number;
  expiresAt: number;
  nativeSupported: boolean;
  uiRows: PullRefreshProbeUIRow[];
  pagerEnabled: boolean;
  acceptPagerJS: boolean;
  pagerRows: PagerProbeRow[];
  droppedPagerRows: number;
  droppedUIRows: number;
  metadata: SafeRecord[];
  exporting: boolean;
  // TEMP(perf-probe): keep the app's file logging on for the whole measured
  // window so business console/logger marks land in the same timeline.
  restoreFileLogging?: boolean;
  expiry?: ReturnType<typeof setTimeout>;
};

const listeners = new Set<() => void>();
const uiFlushers = new Set<(stop?: boolean) => Promise<void>>();
let session: Session | null = null;
let generation = 0;
let snapshot: PullRefreshProbeSnapshot = Object.freeze({
  runId: null,
  expiresAt: 0,
  active: false,
});
let operations: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is SafeRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function numeric(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 1e15
  );
}

function publish(next: PullRefreshProbeSnapshot) {
  snapshot = Object.freeze(next);
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      log({ event: 'subscriber-failed', code: 'probe-subscriber-failed' });
    }
  });
}

function log(data: SafeRecord) {
  const current = session;
  if (!current) {
    return;
  }
  if (!current.exporting) {
    // Even startup/error metadata stays in memory while measuring. In
    // particular, starting this probe must not enable app-wide file logging.
    if (current.metadata.length === METADATA_CAPACITY) {
      current.metadata.shift();
    }
    current.metadata.push(data);
    return;
  }
  // Only callers' allowlisted primitives reach this boundary. ASCII JSON means
  // the length bound is also a byte bound, below the logger's 4 KB entry limit.
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length <= MAX_ENTRY_LENGTH) {
      logger.info(PREFIX, serialized);
    }
  } catch {
    // Diagnostics must not create an unhandled rejection if logging fails.
  }
}

function enqueue(action: () => Promise<void>) {
  const next = operations.then(action);
  operations = next.catch(() => {
    // Never include native errors or potentially sensitive exception messages.
    log({ event: 'operation-failed', code: 'probe-operation-failed' });
  });
  return operations;
}

function bounded<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('probe-timeout')),
      timeoutMs,
    );
    promise.then(
      result => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        reject(new Error('probe-boundary-failed'));
      },
    );
  });
}

async function nativeCommand(
  current: Session,
  command: 'start' | 'drain' | 'stop',
  timeoutMs = 1500,
): Promise<SafeRecord | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }
  try {
    const raw = await bounded(
      RNHelpers.iosPullRefreshProbe(
        command,
        current.runId,
        Math.max(1, current.expiresAt - Date.now()),
      ),
      timeoutMs,
    );
    if (raw.length > 128 * 1024) {
      return null;
    }
    const data: unknown = JSON.parse(raw);
    if (
      !isRecord(data) ||
      data.schemaVersion !== 1 ||
      data.supported !== true ||
      data.status !==
        { start: 'started', drain: 'drained', stop: 'stopped' }[command] ||
      data.runId !== current.runId ||
      !Array.isArray(data.samples) ||
      data.samples.length > 64
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function sanitizeNativeRow(value: unknown): SafeRecord | null {
  if (
    !isRecord(value) ||
    typeof value.event !== 'string' ||
    !NATIVE_EVENTS.has(value.event)
  ) {
    return null;
  }
  const row: SafeRecord = { event: value.event };
  for (const key of [
    'sequence',
    'monotonicMs',
    'unixMs',
    'transactionNumber',
    'viewTag',
    'anchorTag',
    'deltaY',
    'childCount',
    'minIndexForVisible',
    'scopeId',
    'displayTimestampMs',
    'displayTargetTimestampMs',
    'displayDurationMs',
  ]) {
    if (numeric(value[key])) {
      row[key] = value[key];
    }
  }
  for (const key of [
    'headerPresent',
    'anchorPresent',
    'dragging',
    'tracking',
    'decelerating',
    'userTriggeredScrolling',
    'mvcpEnabled',
    'appActive',
  ]) {
    if (typeof value[key] === 'boolean') {
      row[key] = value[key];
    }
  }
  if (value.event === 'display') {
    return row;
  }
  for (const [key, fields] of [
    ['offset', ['x', 'y']],
    ['inset', ['top', 'left', 'bottom', 'right']],
    ['adjustedInset', ['top', 'left', 'bottom', 'right']],
    ['contentSize', ['width', 'height']],
    ['viewport', ['x', 'y', 'width', 'height']],
    ['headerFrame', ['x', 'y', 'width', 'height']],
    ['anchorFrame', ['x', 'y', 'width', 'height']],
    ['previousAnchorFrame', ['x', 'y', 'width', 'height']],
  ] as const) {
    const source = value[key];
    if (!isRecord(source)) {
      continue;
    }
    const geometry: SafeRecord = {};
    for (const field of fields) {
      if (source[field] === null || numeric(source[field])) {
        geometry[field] = source[field];
      }
    }
    row[key] = geometry;
  }
  return row;
}

function writeRows(
  current: Session,
  source: 'ui' | 'native' | 'pager',
  rows: unknown[],
) {
  let batch: unknown[] = [];
  for (const row of rows) {
    const candidate = [...batch, row];
    const envelope = {
      event: 'samples',
      runId: current.runId,
      generation: current.generation,
      source,
      rows: candidate,
    };
    if (
      batch.length &&
      (candidate.length > (source === 'native' ? 1 : 2) ||
        JSON.stringify(envelope).length > MAX_ENTRY_LENGTH)
    ) {
      log({ ...envelope, rows: batch });
      batch = [row];
    } else {
      batch = candidate;
    }
  }
  if (batch.length) {
    log({
      event: 'samples',
      runId: current.runId,
      generation: current.generation,
      source,
      rows: batch,
    });
  }
}

async function flushUI(current: Session, stop = false) {
  await Promise.all(
    [...uiFlushers].map(async flush => {
      try {
        await bounded(Promise.resolve().then(() => flush(stop)));
      } catch {
        log({ event: 'ui-flush-failed', runId: current.runId });
      }
    }),
  );
}

async function exportRows(current: Session, stopReason?: string) {
  // Re-read at export time: the user may have changed this setting while the
  // probe was running. Never disable a logger that was already enabled.
  const priorFileLogging = getEffectiveFileLoggingEnabled();
  try {
    if (!priorFileLogging) {
      setLocalFileLoggingEnabled(true);
    }
    current.exporting = true;
    current.metadata.splice(0).forEach(log);
    log({
      event: 'export-start',
      runId: current.runId,
      at: Date.now(),
      recordingActive: stopReason === undefined,
    });
    writeRows(current, 'ui', current.uiRows.splice(0));
    writeRows(current, 'pager', current.pagerRows.splice(0));
    await drainNative(current);
    if (stopReason !== undefined) {
      log({
        event: 'stopped',
        runId: current.runId,
        reason: STOP_REASONS.has(stopReason) ? stopReason : 'manual',
        droppedUIRows: current.droppedUIRows,
        droppedPagerRows: current.droppedPagerRows,
      });
    }
    await logger.flush();
  } finally {
    current.exporting = false;
    if (!priorFileLogging) {
      setLocalFileLoggingEnabled(false);
    }
  }
}

async function drainNative(current: Session) {
  if (!current.nativeSupported) {
    return;
  }
  // Native storage is capped at 32768 and pages at 64. Also bound wall time so
  // an unexpected native response cannot block cancellation indefinitely.
  const deadline = Date.now() + 30000;
  for (let page = 0; page < 512 && Date.now() < deadline; page++) {
    const data = await nativeCommand(
      current,
      'drain',
      Math.min(1500, deadline - Date.now()),
    );
    if (session !== current) {
      return;
    }
    if (!data) {
      current.nativeSupported = false;
      log({ event: 'native-unavailable', runId: current.runId });
      return;
    }
    const rows = (data.samples as unknown[])
      .map(sanitizeNativeRow)
      .filter((row): row is SafeRecord => row !== null);
    writeRows(current, 'native', rows);
    if (data.hasMore !== true) {
      log({
        event: 'drained',
        runId: current.runId,
        droppedUIRows: current.droppedUIRows,
        ...(numeric(data.droppedSamples)
          ? { droppedNativeRows: data.droppedSamples }
          : {}),
      });
      return;
    }
  }
  log({ event: 'drain-bounded', runId: current.runId });
}

async function stopCurrent(reason: string) {
  const current = session;
  if (!current) {
    return;
  }
  clearTimeout(current.expiry);
  // Also stop after an ambiguous/timed-out start. The native command is scoped
  // to this run id and cannot stop a newer run. Stop before exporting, so the
  // serialization/file work cannot contaminate the measured display window.
  await nativeCommand(current, 'stop');
  // Freeze JS capture before draining UI tails or enabling export logging.
  // UI batches carry their original timestamps and may arrive until flush ack.
  current.acceptPagerJS = false;
  await flushUI(current, true);
  try {
    await exportRows(current, reason);
  } finally {
    session = null;
    if (current.restoreFileLogging) {
      setLocalFileLoggingEnabled(false);
    }
    publish({ runId: null, expiresAt: 0, active: false });
  }
}

/** Called only after the existing lifecycle scenario has passed its opt-in gates. */
export function startPullRefreshProbe(command: {
  runId: string;
  expiresAt: number;
  perpsRootProbe?: boolean;
}): Promise<void> {
  if (
    !isNonPublicProductionEnv ||
    (Platform.OS !== 'ios' &&
      !(Platform.OS === 'android' && command.perpsRootProbe === true)) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(command.runId) ||
    !numeric(command.expiresAt) ||
    command.expiresAt <= Date.now()
  ) {
    return Promise.resolve();
  }
  return enqueue(async () => {
    if (session?.runId === command.runId) {
      return;
    }
    await stopCurrent('replaced');
    const startedAt = Date.now();
    if (command.expiresAt <= startedAt) {
      return;
    }
    const current: Session = {
      generation: ++generation,
      runId: command.runId,
      startedAt,
      expiresAt: Math.min(command.expiresAt, startedAt + MAX_TTL),
      nativeSupported: false,
      uiRows: [],
      pagerEnabled: command.perpsRootProbe === true,
      acceptPagerJS: true,
      pagerRows: [],
      droppedPagerRows: 0,
      droppedUIRows: 0,
      metadata: [],
      exporting: false,
    };
    session = current;
    if (!getEffectiveFileLoggingEnabled()) {
      setLocalFileLoggingEnabled(true);
      current.restoreFileLogging = true;
    }
    const native = await nativeCommand(current, 'start');
    current.nativeSupported = native?.status === 'started';
    log({
      event: 'started',
      runId: current.runId,
      generation: current.generation,
      startedAt,
      expiresAt: current.expiresAt,
      nativeSupported: current.nativeSupported,
      pagerEnabled: current.pagerEnabled,
    });
    if (!current.nativeSupported) {
      log({ event: 'native-unsupported', runId: current.runId });
    }
    publish({
      runId: current.runId,
      expiresAt: current.expiresAt,
      active: true,
      ...(current.pagerEnabled ? { pagerEnabled: true } : {}),
    });
    current.expiry = setTimeout(() => {
      if (session === current) {
        void stopPullRefreshProbe('expired');
      }
    }, Math.max(0, current.expiresAt - Date.now()));
  });
}

export function stopPullRefreshProbe(reason: string): Promise<void> {
  return enqueue(() => stopCurrent(reason));
}

export function flushPullRefreshProbe(): Promise<void> {
  const requestedSession = session;
  return enqueue(async () => {
    if (!requestedSession || session !== requestedSession) {
      return;
    }
    await flushUI(requestedSession);
    await exportRows(requestedSession);
  });
}

export function getPullRefreshProbeSnapshot(): PullRefreshProbeSnapshot {
  return snapshot;
}

export function subscribePullRefreshProbe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerPullRefreshProbeUIFlusher(
  flush: (stop?: boolean) => Promise<void>,
): () => void {
  uiFlushers.add(flush);
  return () => uiFlushers.delete(flush);
}

export function recordPullRefreshProbeUI(
  runId: string,
  rows: readonly PullRefreshProbeUIRow[],
): void {
  const current = session;
  if (!current || current.runId !== runId) {
    return;
  }
  current.droppedUIRows += Math.max(0, rows.length - UI_CAPACITY);
  for (const row of rows.slice(-UI_CAPACITY)) {
    if (
      !isRecord(row) ||
      !UI_PHASES.has(row.phase) ||
      !UI_SCOPES.has(row.scope) ||
      !numeric(row.at) ||
      row.at < current.startedAt ||
      row.at > current.expiresAt ||
      !numeric(row.pull) ||
      !numeric(row.scrollY) ||
      typeof row.refreshing !== 'boolean' ||
      typeof row.manual !== 'boolean'
    ) {
      continue;
    }
    const safe: PullRefreshProbeUIRow = {
      at: row.at,
      scope: row.scope,
      phase: row.phase,
      pull: row.pull,
      scrollY: row.scrollY,
      refreshing: row.refreshing,
      manual: row.manual,
    };
    if (numeric(row.height)) {
      safe.height = row.height;
    }
    if (numeric(row.pageY)) {
      safe.pageY = row.pageY;
    }
    if (typeof row.success === 'boolean') {
      safe.success = row.success;
    }
    if (typeof row.loading === 'boolean') {
      safe.loading = row.loading;
    }
    if (current.uiRows.length === UI_CAPACITY) {
      current.uiRows.shift();
      current.droppedUIRows++;
    }
    current.uiRows.push(safe);
  }
}

/** Strict primitive projection; never export arbitrary observer payloads. */
export function recordPagerProbe(
  runId: string,
  rows: readonly PagerProbeRow[],
): void {
  const current = session;
  if (!current?.pagerEnabled || current.runId !== runId) {
    return;
  }
  current.droppedPagerRows += Math.max(0, rows.length - PAGER_CAPACITY);
  for (const row of rows.slice(-PAGER_CAPACITY)) {
    if (
      !isRecord(row) ||
      !PAGER_EVENTS.has(row.event as string) ||
      (row.domain !== 'ui' && row.domain !== 'js') ||
      (row.domain === 'js' && !current.acceptPagerJS) ||
      !numeric(row.at) ||
      row.at < current.startedAt ||
      row.at > current.expiresAt ||
      !numeric(row.monoMs) ||
      !Number.isSafeInteger(row.sequence) ||
      row.sequence < 0
    ) {
      continue;
    }
    const safe: PagerProbeRow = {
      event: row.event,
      domain: row.domain,
      at: row.at,
      monoMs: row.monoMs,
      sequence: row.sequence,
    };
    for (const key of [
      'epoch',
      'fromEpoch',
      'command',
      'selected',
      'target',
      'position',
      'actualDuration',
      'baseDuration',
      'startTime',
      'commitTime',
      'dropped',
    ] as const) {
      if (numeric(row[key])) {
        safe[key] = row[key];
      }
    }
    if (typeof row.settled === 'boolean') {
      safe.settled = row.settled;
    }
    if (row.origin && PAGER_ORIGINS.has(row.origin)) {
      safe.origin = row.origin;
    }
    if (row.page === 'simple' || row.page === 'pro') {
      safe.page = row.page;
    }
    if (
      row.phase === 'mount' ||
      row.phase === 'update' ||
      row.phase === 'nested-update'
    ) {
      safe.phase = row.phase;
    }
    if (current.pagerRows.length === PAGER_CAPACITY) {
      current.pagerRows.shift();
      current.droppedPagerRows++;
    }
    current.pagerRows.push(safe);
  }
}
