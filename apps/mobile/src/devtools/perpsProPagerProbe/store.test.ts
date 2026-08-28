import { PerpsProPagerProbeStore } from './store';

describe('PerpsProPagerProbeStore', () => {
  it('records only while capture is active and produces a bounded export', () => {
    let now = 1000;
    const store = new PerpsProPagerProbeStore({ now: () => now });

    expect(store.record('tab_request', { tab: 'positions' })).toBe(false);
    store.start({ platform: 'android' });
    now += 5;
    expect(store.record('tab_request', { tab: 'account' })).toBe(true);
    now += 5;
    store.stop();
    expect(store.record('tab_commit', { tab: 'account' })).toBe(false);

    expect(store.export()).toMatchObject({
      droppedEvents: 0,
      metadata: { platform: 'android' },
      schemaVersion: 1,
      sessionId: 'perps-pro-pager-1000',
      startedAt: 1000,
      stoppedAt: 1010,
    });
    expect(store.export()?.events.map(event => event.kind)).toEqual([
      'capture_started',
      'tab_request',
      'capture_stopped',
    ]);
  });

  it('sanitizes strings and non-finite numbers before storage', () => {
    const store = new PerpsProPagerProbeStore({
      limits: {
        maxBytes: 10_000,
        maxEventBytes: 2_000,
        maxEvents: 10,
        maxPayloadEntries: 2,
        maxStringLength: 4,
      },
    });

    store.start();
    store.record('page_selected', {
      firstLongKey: 'abcdef',
      infinity: Number.POSITIVE_INFINITY,
      ignored: 'value',
    });

    expect(store.export()?.events.at(-1)?.payload).toEqual({
      firs: 'abcd',
      infi: null,
    });
  });

  it('drops events after reaching an event or byte limit', () => {
    const store = new PerpsProPagerProbeStore({
      limits: {
        maxBytes: 1_000,
        maxEventBytes: 500,
        maxEvents: 2,
        maxPayloadEntries: 4,
        maxStringLength: 32,
      },
    });

    store.start();
    store.record('tab_request', { tab: 'positions' });
    store.record('tab_commit', { tab: 'positions' });

    expect(store.getStatus()).toMatchObject({
      droppedEvents: 1,
      eventCount: 2,
    });
  });
});
