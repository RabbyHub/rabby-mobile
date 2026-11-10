// Unit contracts: the native bridge and file logger are mocked. These tests do
// not reproduce UIKit scrolling, Reanimated timing, or prove #1130 is fixed.
import type { PullRefreshProbeUIRow } from './controller.prod';
import type { PagerProbeRow } from './pagerTypes';

function createHarness(options: { nonprod?: boolean; os?: string } = {}) {
  jest.resetModules();
  let fileLogging = false;
  const info = jest.fn();
  const flush = jest.fn(async () => {});
  const setEnabled = jest.fn((enabled: boolean) => {
    fileLogging = enabled;
  });
  const native = jest.fn(async (command: string, runId: string) =>
    JSON.stringify({
      schemaVersion: 1,
      supported: true,
      status:
        command === 'start'
          ? 'started'
          : command === 'stop'
          ? 'stopped'
          : 'drained',
      runId,
      hasMore: false,
      droppedSamples: 0,
      samples: [],
    }),
  );
  jest.doMock('react-native', () => ({
    Platform: { OS: options.os || 'ios' },
  }));
  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv: options.nonprod !== false,
  }));
  jest.doMock('@/core/native/RNHelpers', () => ({
    __esModule: true,
    default: { iosPullRefreshProbe: native },
  }));
  jest.doMock('@/utils/logger', () => ({ logger: { info, flush } }));
  jest.doMock('@/utils/logging/settings', () => ({
    getEffectiveFileLoggingEnabled: () => fileLogging,
    setLocalFileLoggingEnabled: setEnabled,
  }));
  const controller =
    require('./controller.nonprod') as typeof import('./controller.nonprod');
  const entries = () =>
    info.mock.calls.map(([, entry]: [string, string]) => JSON.parse(entry));
  return {
    ...controller,
    native,
    info,
    flush,
    setEnabled,
    entries,
    setInitialLogging(enabled: boolean) {
      fileLogging = enabled;
    },
    isLogging: () => fileLogging,
  };
}

function uiRow(overrides: Partial<PullRefreshProbeUIRow> = {}) {
  return {
    at: Date.now(),
    scope: 'home-token-list',
    phase: 'sample',
    pull: 123,
    scrollY: -80,
    refreshing: true,
    manual: false,
    ...overrides,
  } as PullRefreshProbeUIRow;
}

describe('temporary pull-refresh probe controller (unit)', () => {
  it('stops JS collection before a held UI flush while retaining timestamped UI tails', async () => {
    const probe = createHarness({ os: 'android' });
    await probe.startPullRefreshProbe({
      runId: 'stop-boundary',
      expiresAt: Date.now() + 5000,
      perpsRootProbe: true,
    });
    const row: PagerProbeRow = {
      event: 'react-commit',
      domain: 'js',
      at: Date.now(),
      monoMs: 100,
      sequence: 1,
    };
    probe.recordPagerProbe('stop-boundary', [row]);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => {
      enter = resolve;
    });
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const unregister = probe.registerPullRefreshProbeUIFlusher(async () => {
      probe.recordPagerProbe('stop-boundary', [
        { ...row, sequence: 2 },
        { ...row, event: 'release', domain: 'ui', sequence: 3 },
      ]);
      enter();
      await held;
    });
    probe.flush.mockImplementation(async () => {
      probe.recordPagerProbe('stop-boundary', [{ ...row, sequence: 4 }]);
    });
    const stopping = probe.stopPullRefreshProbe('cancel');
    await entered;
    release();
    await stopping;
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'pager')
      .flatMap(entry => entry.rows);
    expect(rows.map(item => item.sequence)).toEqual([1, 3]);
    expect(rows.map(item => item.at)).toEqual([row.at, row.at]);
    unregister();
  });

  it('collects a separate bounded pager channel on Android without calling native', async () => {
    const probe = createHarness({ os: 'android' });
    await probe.startPullRefreshProbe({
      runId: 'pager-run',
      expiresAt: Date.now() + 5000,
      perpsRootProbe: true,
    });
    expect(probe.getPullRefreshProbeSnapshot()).toMatchObject({
      active: true,
      pagerEnabled: true,
    });
    const row: PagerProbeRow = {
      event: 'release',
      domain: 'ui',
      at: Date.now(),
      monoMs: 100,
      sequence: 1,
      fromEpoch: 4,
      epoch: 5,
    };
    probe.recordPagerProbe('wrong', [row]);
    probe.recordPagerProbe('pager-run', [
      { ...row, domain: 'invalid' } as unknown as PagerProbeRow,
      { ...row, at: Date.now() + 6000 },
      ...Array.from({ length: 4100 }, (_, sequence) => ({
        ...row,
        sequence,
        privateValue: 'never-export',
      })),
    ]);
    expect(probe.info).not.toHaveBeenCalled();
    expect(probe.setEnabled).not.toHaveBeenCalled();
    await probe.stopPullRefreshProbe('cancel');
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'pager')
      .flatMap(entry => entry.rows);
    expect(rows).toHaveLength(4096);
    expect(rows[0]).toMatchObject({
      sequence: 4,
      fromEpoch: 4,
      epoch: 5,
      domain: 'ui',
    });
    expect(JSON.stringify(probe.entries())).not.toContain('never-export');
    expect(probe.native).not.toHaveBeenCalled();
  });

  it('does not arm the pager channel for an ordinary Home probe or public build', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'home-only',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPagerProbe('home-only', [
      {
        event: 'react-commit',
        domain: 'js',
        at: Date.now(),
        monoMs: 1,
        sequence: 1,
      },
    ]);
    await probe.stopPullRefreshProbe('cancel');
    expect(probe.entries().some(entry => entry.source === 'pager')).toBe(false);
    const publicProbe = createHarness({ nonprod: false, os: 'android' });
    await publicProbe.startPullRefreshProbe({
      runId: 'public-pager',
      expiresAt: Date.now() + 5000,
      perpsRootProbe: true,
    });
    expect(publicProbe.getPullRefreshProbeSnapshot().active).toBe(false);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_800_000_000_000);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([{ nonprod: false }, { os: 'android' }])(
    'stays inert behind environment gates: %p',
    async options => {
      const probe = createHarness(options);
      await probe.startPullRefreshProbe({
        runId: 'safe-run',
        expiresAt: Date.now() + 5000,
      });
      expect(probe.getPullRefreshProbeSnapshot().active).toBe(false);
      expect(probe.native).not.toHaveBeenCalled();
      expect(probe.setEnabled).not.toHaveBeenCalled();
    },
  );

  it('rejects expired commands and run ids that could carry arbitrary text', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'invalid run id',
      expiresAt: Date.now() + 5000,
    });
    await probe.startPullRefreshProbe({
      runId: 'safe-run',
      expiresAt: Date.now(),
    });
    expect(probe.native).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('collects only allowlisted rows and bounds each serialized entry', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'allowlist',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI('wrong-run', [uiRow()]);
    probe.recordPullRefreshProbeUI('allowlist', [
      uiRow({ at: Date.now() - 1 }),
      uiRow({ pull: Number.NaN }),
      ...Array.from({ length: 24 }, () => ({
        ...uiRow(),
        unexpected: 'must-not-appear',
      })),
    ]);
    await probe.flushPullRefreshProbe();
    const batches = probe.entries().filter(entry => entry.source === 'ui');
    expect(batches).toHaveLength(3);
    expect(batches.flatMap(entry => entry.rows)).toHaveLength(24);
    expect(JSON.stringify(probe.entries())).not.toContain('must-not-appear');
    for (const [, serialized] of probe.info.mock.calls) {
      expect(serialized.length).toBeLessThan(4000);
    }
    await probe.stopPullRefreshProbe('cancelled');
  });

  it('accepts command-compatible dotted 96-character run ids and rejects overflow', async () => {
    const probe = createHarness();
    const runId = `qa1130.${'a'.repeat(89)}`;
    expect(runId).toHaveLength(96);
    await probe.startPullRefreshProbe({
      runId: `${runId}a`,
      expiresAt: Date.now() + 5000,
    });
    await probe.startPullRefreshProbe({
      runId: '.invalid-leading-dot',
      expiresAt: Date.now() + 5000,
    });
    expect(probe.native).not.toHaveBeenCalled();
    await probe.startPullRefreshProbe({
      runId,
      expiresAt: Date.now() + 5000,
    });
    expect(probe.getPullRefreshProbeSnapshot()).toEqual(
      expect.objectContaining({ runId, active: true }),
    );
    await probe.stopPullRefreshProbe('cancel');
    expect(probe.entries()).toContainEqual(
      expect.objectContaining({ event: 'stopped', reason: 'cancel' }),
    );
  });

  it('preserves only known list scopes', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'scopes',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI('scopes', [
      uiRow(),
      uiRow({ scope: 'home-defi-list' }),
      uiRow({ scope: 'home-nft-list' }),
      uiRow({ scope: 'unknown-list' as PullRefreshProbeUIRow['scope'] }),
    ]);
    await probe.flushPullRefreshProbe();
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'ui')
      .flatMap(entry => entry.rows);
    expect(rows.map(row => row.scope)).toEqual([
      'home-token-list',
      'home-defi-list',
      'home-nft-list',
    ]);
    await probe.stopPullRefreshProbe('cancel');
  });

  it('keeps a bounded UI buffer and reports dropped rows', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'bounded',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI(
      'bounded',
      Array.from({ length: 32770 }, (_, pull) => uiRow({ pull })),
    );
    probe.recordPullRefreshProbeUI('bounded', [uiRow({ pull: 9999 })]);
    await probe.flushPullRefreshProbe();
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'ui')
      .flatMap(entry => entry.rows);
    expect(rows).toHaveLength(32768);
    expect(rows[0].pull).toBe(3);
    expect(rows[32767].pull).toBe(9999);
    expect(probe.entries()).toContainEqual(
      expect.objectContaining({ event: 'drained', droppedUIRows: 3 }),
    );
    await probe.stopPullRefreshProbe('cancelled');
  });

  it('does not drain or write sample logs periodically while recording', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'memory-only',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI('memory-only', [uiRow()]);
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(probe.native).toHaveBeenCalledTimes(1);
    expect(probe.info).not.toHaveBeenCalled();
    expect(probe.flush).not.toHaveBeenCalled();
    expect(probe.setEnabled).not.toHaveBeenCalled();
    expect(probe.isLogging()).toBe(false);
    await probe.stopPullRefreshProbe('cancel');
    expect(probe.entries().some(entry => entry.source === 'ui')).toBe(true);
  });

  it('accepts display and container events and drains beyond the former 32-page limit', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'native-display',
      expiresAt: Date.now() + 5000,
    });
    const events = [
      'display',
      'container-before',
      'container-after',
      'size-before',
      'size-after',
    ];
    let pages = 0;
    probe.native.mockImplementation(async (command, runId) => {
      if (command === 'drain') {
        pages++;
      }
      return JSON.stringify({
        schemaVersion: 1,
        supported: true,
        runId,
        status: command === 'stop' ? 'stopped' : 'drained',
        hasMore: command === 'drain' && pages < 40,
        samples:
          command === 'drain'
            ? events.map(event => ({
                event,
                sequence: pages,
                scopeId: event === 'display' ? 0 : 2,
                monotonicMs: 1000,
                unixMs: Date.now(),
                displayTimestampMs: 990,
                displayTargetTimestampMs: 1006.67,
                displayDurationMs: 16.67,
                appActive: true,
                headerFrame: { height: 48 },
                privateData: 'must-not-appear',
              }))
            : [],
      });
    });
    await probe.stopPullRefreshProbe('cancel');
    expect(pages).toBe(40);
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'native')
      .flatMap(entry => entry.rows);
    expect(rows).toHaveLength(200);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        event: 'display',
        scopeId: 0,
        displayTimestampMs: 990,
        displayTargetTimestampMs: 1006.67,
        displayDurationMs: 16.67,
        appActive: true,
      }),
    );
    expect(rows[0].headerFrame).toBeUndefined();
    expect(rows[1].headerFrame).toEqual({ height: 48 });
    expect(JSON.stringify(rows)).not.toContain('must-not-appear');
  });

  it('flushes UI and native pages before restoring the previous logging setting', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'ordered-stop',
      expiresAt: Date.now() + 5000,
    });
    const calls: string[] = [];
    const unregister = probe.registerPullRefreshProbeUIFlusher(async stop => {
      calls.push('ui-flush');
      expect(stop).toBe(true);
      expect(probe.isLogging()).toBe(false);
      expect(probe.getPullRefreshProbeSnapshot().active).toBe(true);
      probe.recordPullRefreshProbeUI('ordered-stop', [uiRow()]);
    });
    let drainCount = 0;
    probe.native.mockImplementation(async (command, runId) => {
      calls.push(command);
      if (command === 'drain') {
        drainCount++;
      }
      return JSON.stringify({
        schemaVersion: 1,
        supported: true,
        status: command === 'stop' ? 'stopped' : 'drained',
        runId,
        hasMore: command === 'drain' && drainCount === 1,
        samples:
          command === 'drain'
            ? [
                {
                  event: 'adjust-after',
                  sequence: drainCount,
                  offset: { x: 0, y: -90, content: 'must-not-appear' },
                  deltaY: -90,
                  address: 'must-not-appear',
                },
              ]
            : [],
      });
    });
    probe.flush.mockImplementation(async () => {
      calls.push('logger-flush');
      expect(probe.isLogging()).toBe(true);
    });
    await probe.stopPullRefreshProbe('arbitrary sensitive text');
    expect(calls).toEqual([
      'stop',
      'ui-flush',
      'drain',
      'drain',
      'logger-flush',
    ]);
    expect(probe.isLogging()).toBe(false);
    expect(probe.setEnabled.mock.calls).toEqual([[true], [false]]);
    expect(probe.getPullRefreshProbeSnapshot().active).toBe(false);
    expect(JSON.stringify(probe.entries())).not.toContain('must-not-appear');
    expect(JSON.stringify(probe.entries())).not.toContain('sensitive');
    expect(jest.getTimerCount()).toBe(0);
    unregister();
  });

  it.each([
    { pageTime: 0, expectedPages: 512 },
    { pageTime: 1000, expectedPages: 30 },
  ])('bounds native draining by pages and elapsed time: %p', async options => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'bounded-drain',
      expiresAt: Date.now() + 120000,
    });
    let pages = 0;
    probe.native.mockImplementation(async (command, runId) => {
      if (command === 'drain') {
        pages++;
        jest.setSystemTime(Date.now() + options.pageTime);
      }
      return JSON.stringify({
        schemaVersion: 1,
        supported: true,
        status: command === 'stop' ? 'stopped' : 'drained',
        runId,
        hasMore: true,
        samples: [],
      });
    });
    await probe.stopPullRefreshProbe('cancel');
    expect(pages).toBe(options.expectedPages);
    expect(probe.entries()).toContainEqual({
      event: 'drain-bounded',
      runId: 'bounded-drain',
    });
    expect(probe.isLogging()).toBe(false);
  });

  it('preserves an already enabled file logger and makes active run starts idempotent', async () => {
    const probe = createHarness();
    probe.setInitialLogging(true);
    const command = { runId: 'already-enabled', expiresAt: Date.now() + 5000 };
    await probe.startPullRefreshProbe(command);
    await probe.startPullRefreshProbe(command);
    expect(
      probe.native.mock.calls.filter(([op]) => op === 'start'),
    ).toHaveLength(1);
    await probe.stopPullRefreshProbe('cancelled');
    expect(probe.setEnabled).not.toHaveBeenCalled();
    expect(probe.isLogging()).toBe(true);
  });

  it('enables logging only for explicit export and preserves user changes during recording', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'export-only',
      expiresAt: Date.now() + 5000,
    });
    expect(probe.setEnabled).not.toHaveBeenCalled();
    await probe.flushPullRefreshProbe();
    expect(probe.setEnabled.mock.calls).toEqual([[true], [false]]);
    expect(probe.isLogging()).toBe(false);
    expect(probe.getPullRefreshProbeSnapshot().active).toBe(true);
    probe.setEnabled.mockClear();
    probe.setInitialLogging(true);
    await probe.stopPullRefreshProbe('cancel');
    expect(probe.setEnabled).not.toHaveBeenCalled();
    expect(probe.isLogging()).toBe(true);
  });

  it('caps the TTL to five minutes and removes timers on expiry', async () => {
    const probe = createHarness();
    const start = Date.now();
    await probe.startPullRefreshProbe({
      runId: 'expires',
      expiresAt: start + 600_000,
    });
    expect(probe.getPullRefreshProbeSnapshot().expiresAt).toBe(start + 300_000);
    jest.advanceTimersByTime(300_000);
    await probe.flushPullRefreshProbe();
    expect(probe.getPullRefreshProbeSnapshot().active).toBe(false);
    expect(probe.isLogging()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('discards old-run batches after replacing the session', async () => {
    const probe = createHarness();
    await probe.startPullRefreshProbe({
      runId: 'old-run',
      expiresAt: Date.now() + 5000,
    });
    await probe.startPullRefreshProbe({
      runId: 'new-run',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI('old-run', [uiRow({ pull: 10001 })]);
    probe.recordPullRefreshProbeUI('new-run', [uiRow({ pull: 10002 })]);
    await probe.flushPullRefreshProbe();
    const rows = probe
      .entries()
      .filter(entry => entry.source === 'ui')
      .flatMap(entry => entry.rows);
    expect(rows).toEqual([expect.objectContaining({ pull: 10002 })]);
    await probe.stopPullRefreshProbe('cancelled');
  });

  it('reports native unsupported without exposing native errors or retrying drains', async () => {
    const probe = createHarness();
    probe.native.mockRejectedValue(new Error('must-not-appear'));
    await probe.startPullRefreshProbe({
      runId: 'unsupported',
      expiresAt: Date.now() + 5000,
    });
    await probe.flushPullRefreshProbe();
    expect(probe.entries()).toContainEqual({
      event: 'native-unsupported',
      runId: 'unsupported',
    });
    expect(JSON.stringify(probe.entries())).not.toContain('must-not-appear');
    expect(probe.native).toHaveBeenCalledTimes(1);
    await probe.stopPullRefreshProbe('cancelled');
  });

  it('keeps the production controller inert with the same API', async () => {
    const probe =
      require('./controller.prod') as typeof import('./controller.prod');
    const listener = jest.fn();
    const flush = jest.fn(async () => {});
    probe.subscribePullRefreshProbe(listener)();
    probe.registerPullRefreshProbeUIFlusher(flush)();
    await probe.startPullRefreshProbe({
      runId: 'production',
      expiresAt: Date.now() + 5000,
    });
    probe.recordPullRefreshProbeUI('production', [uiRow()]);
    await probe.flushPullRefreshProbe();
    await probe.stopPullRefreshProbe('cancelled');
    expect(probe.getPullRefreshProbeSnapshot()).toEqual({
      runId: null,
      expiresAt: 0,
      active: false,
    });
    expect(listener).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });
});
