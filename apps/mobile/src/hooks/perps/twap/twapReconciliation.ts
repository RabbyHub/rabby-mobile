import BigNumber from 'bignumber.js';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  getPerpsTwapKey,
  type PerpsTwapFill,
  type PerpsTwapRecord,
  type PerpsTwapState,
  type PerpsTwapStatus,
} from './types';

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const decimal = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value);
const terminal = (status: string) =>
  ['finished', 'terminated', 'error', 'stopped'].includes(status);

export const parsePerpsTwapState = (
  value: unknown,
  user: string,
): PerpsTwapState | null => {
  if (
    !object(value) ||
    typeof value.coin !== 'string' ||
    !value.coin ||
    typeof value.user !== 'string' ||
    !isSameAddress(value.user, user) ||
    (value.side !== 'A' && value.side !== 'B') ||
    !decimal(value.sz) ||
    !new BigNumber(value.sz).gt(0) ||
    !decimal(value.executedSz) ||
    !decimal(value.executedNtl) ||
    !integer(value.minutes) ||
    value.minutes < 1 ||
    !integer(value.timestamp) ||
    typeof value.randomize !== 'boolean' ||
    typeof value.reduceOnly !== 'boolean'
  )
    return null;
  return {
    coin: value.coin,
    user: value.user,
    side: value.side,
    sz: value.sz,
    executedSz: value.executedSz,
    executedNtl: value.executedNtl,
    minutes: value.minutes,
    timestamp: value.timestamp,
    randomize: value.randomize,
    reduceOnly: value.reduceOnly,
    trigger:
      object(value.trigger) && decimal(value.trigger.px)
        ? { px: value.trigger.px }
        : null,
    stopPx: decimal(value.stopPx) ? value.stopPx : null,
  };
};

export const parsePerpsTwapHistory = (
  value: unknown,
  user: string,
): PerpsTwapRecord | null => {
  if (
    !object(value) ||
    !integer(value.twapId) ||
    !integer(value.time) ||
    !object(value.status) ||
    typeof value.status.status !== 'string'
  )
    return null;
  const state = parsePerpsTwapState(value.state, user);
  if (!state) return null;
  const eventTime = value.time * 1000;
  if (!Number.isSafeInteger(eventTime)) return null;
  return {
    key: getPerpsTwapKey(state.coin, value.twapId),
    twapId: value.twapId,
    state,
    status: value.status.status,
    description:
      typeof value.status.description === 'string'
        ? value.status.description
        : undefined,
    eventTime,
    endedAt: terminal(value.status.status) ? eventTime : null,
    active: false,
  };
};

export const parsePerpsTwapFill = (value: unknown): PerpsTwapFill | null => {
  if (!object(value) || !integer(value.twapId) || !object(value.fill))
    return null;
  const f = value.fill;
  if (
    !integer(f.tid) ||
    !integer(f.oid) ||
    !integer(f.time) ||
    typeof f.coin !== 'string' ||
    !f.coin ||
    (f.side !== 'A' && f.side !== 'B') ||
    !decimal(f.px) ||
    !decimal(f.sz) ||
    !new BigNumber(f.sz).gt(0) ||
    typeof f.fee !== 'string' ||
    !new BigNumber(f.fee).isFinite() ||
    typeof f.feeToken !== 'string'
  )
    return null;
  return {
    key: `${getPerpsTwapKey(f.coin, value.twapId)}:${f.tid}`,
    twapId: value.twapId,
    coin: f.coin,
    tid: f.tid,
    oid: f.oid,
    time: f.time,
    side: f.side,
    px: f.px,
    sz: f.sz,
    fee: f.fee,
    feeToken: f.feeToken,
  };
};

const sameState = (a: PerpsTwapState, b: PerpsTwapState) =>
  a.coin === b.coin &&
  isSameAddress(a.user, b.user) &&
  a.side === b.side &&
  a.sz === b.sz &&
  a.executedSz === b.executedSz &&
  a.executedNtl === b.executedNtl &&
  a.minutes === b.minutes &&
  a.timestamp === b.timestamp &&
  a.randomize === b.randomize &&
  a.reduceOnly === b.reduceOnly &&
  a.trigger?.px === b.trigger?.px &&
  a.stopPx === b.stopPx;
const sameRecord = (a: PerpsTwapRecord | undefined, b: PerpsTwapRecord) =>
  a &&
  a.active === b.active &&
  a.status === b.status &&
  a.endedAt === b.endedAt &&
  a.eventTime === b.eventTime &&
  a.description === b.description &&
  sameState(a.state, b.state);

/** History timestamps are seconds; active state timestamps are milliseconds. */
export const mergePerpsTwapHistory = (
  current: Readonly<Record<string, PerpsTwapRecord>>,
  history: readonly PerpsTwapRecord[],
): Readonly<Record<string, PerpsTwapRecord>> => {
  let next: Record<string, PerpsTwapRecord> | null = null;
  for (const incoming of history) {
    const previous = (next ?? current)[incoming.key];
    if (
      previous &&
      (previous.eventTime > incoming.eventTime ||
        (terminal(previous.status) && !terminal(incoming.status)))
    )
      continue;
    const state =
      previous?.active &&
      !terminal(incoming.status) &&
      new BigNumber(previous.state.executedSz).gte(incoming.state.executedSz)
        ? previous.state
        : incoming.state;
    const record = {
      ...incoming,
      state,
      active: !terminal(incoming.status) && !!previous?.active,
    };
    if (!sameRecord(previous, record)) {
      if (!next) next = { ...current };
      next[incoming.key] = record;
    }
  }
  return next ?? current;
};

/** The subscription owns ALL_DEXS. Spot filtering belongs to the market resolver. */
export const replacePerpsTwapActiveSnapshot = (
  current: Readonly<Record<string, PerpsTwapRecord>>,
  entries: readonly [number, PerpsTwapState][],
): Readonly<Record<string, PerpsTwapRecord>> => {
  const next: Record<string, PerpsTwapRecord> = { ...current };
  const activeKeys = new Set<string>();
  let changed = false;
  for (const [twapId, incomingState] of entries) {
    const key = getPerpsTwapKey(incomingState.coin, twapId);
    const previous = current[key];
    if (previous && terminal(previous.status)) continue;
    activeKeys.add(key);
    const state =
      previous &&
      new BigNumber(previous.state.executedSz).gt(incomingState.executedSz)
        ? {
            ...incomingState,
            executedSz: previous.state.executedSz,
            executedNtl: previous.state.executedNtl,
          }
        : incomingState;
    const record: PerpsTwapRecord = {
      key,
      twapId,
      state,
      status: state.trigger ? 'waitingForTrigger' : 'activated',
      eventTime: previous?.eventTime ?? 0,
      endedAt: null,
      active: true,
    };
    if (!sameRecord(previous, record)) {
      next[key] = record;
      changed = true;
    }
  }
  for (const record of Object.values(current)) {
    if (record.active && !activeKeys.has(record.key)) {
      next[record.key] = { ...record, active: false };
      changed = true;
    }
  }
  return changed ? next : current;
};

export const mergePerpsTwapFills = (
  current: readonly PerpsTwapFill[],
  incoming: readonly PerpsTwapFill[],
): readonly PerpsTwapFill[] => {
  const unique = new Map(current.map(fill => [fill.key, fill]));
  let changed = false;
  for (const fill of incoming) {
    const previous = unique.get(fill.key);
    if (
      previous &&
      Object.keys(fill).every(
        key =>
          previous[key as keyof PerpsTwapFill] ===
          fill[key as keyof PerpsTwapFill],
      )
    )
      continue;
    unique.set(fill.key, fill);
    changed = true;
  }
  if (!changed) return current;
  return [...unique.values()].sort((a, b) => b.time - a.time || b.tid - a.tid);
};

export const getPerpsTwapStatus = (
  record: PerpsTwapRecord,
): PerpsTwapStatus => {
  if (record.status === 'terminated') return 'cancelled';
  if (record.status === 'error' || record.status === 'stopped')
    return 'expired';
  if (record.status === 'finished')
    return new BigNumber(record.state.executedSz).gte(record.state.sz)
      ? 'filled'
      : 'expired';
  if (record.active && record.status === 'waitingForTrigger') return 'waiting';
  if (record.active && record.status === 'activated') return 'working';
  return 'unknown';
};

export const getPerpsTwapSummary = (
  record: PerpsTwapRecord,
  currentPrice?: string,
) => {
  const { state } = record;
  const filled = new BigNumber(state.executedSz);
  const average = filled.gt(0)
    ? new BigNumber(state.executedNtl).div(filled)
    : null;
  const price =
    record.endedAt === null ? new BigNumber(currentPrice ?? NaN) : average;
  const totalQuote =
    price?.isFinite() && price.gt(0)
      ? new BigNumber(state.sz).times(price).toFixed()
      : null;
  return {
    averagePrice: average?.toFixed() ?? null,
    totalQuote,
    filledQuote: state.executedNtl,
    percentage: BigNumber.minimum(
      100,
      BigNumber.maximum(0, filled.div(state.sz).times(100)),
    ).toNumber(),
    plannedSeconds: state.minutes * 60,
    actualSeconds:
      record.endedAt === null
        ? null
        : Math.max(0, Math.round((record.endedAt - state.timestamp) / 1000)),
    status: getPerpsTwapStatus(record),
  };
};
