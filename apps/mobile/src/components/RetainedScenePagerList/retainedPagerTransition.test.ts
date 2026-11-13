import {
  createRetainedPagerTransition,
  reduceRetainedPagerTransition,
  type RetainedPagerPlatform,
  type RetainedPagerTransitionEvent,
  type RetainedPagerTransitionState,
} from './retainedPagerTransition';

const platforms: RetainedPagerPlatform[] = ['ios', 'android'];
const create = (platform: RetainedPagerPlatform = 'ios', initialIndex = 0) =>
  createRetainedPagerTransition({ platform, pageCount: 3, initialIndex });

// Unit coverage of the production reducer, using native event sequences. These
// tests do not claim that a mocked pager proves UIKit/ViewPager2 integration.
const driver = (initial: RetainedPagerTransitionState = create()) => {
  let current = initial;
  return {
    get state() {
      return current;
    },
    send(event: RetainedPagerTransitionEvent) {
      const result = reduceRetainedPagerTransition(
        Object.freeze(current),
        event,
      );
      current = result.state;
      return result.effects;
    },
  };
};

describe('retained pager initialization and observations', () => {
  it.each(platforms)('%s starts at the requested nonzero page', platform => {
    const pager = driver(create(platform, 2));
    expect(pager.state).toEqual({
      platform,
      pageCount: 3,
      settledIndex: 2,
      phase: 'idle',
      epoch: 0,
      requestedIndex: null,
      queuedIndex: null,
      selectedIndex: null,
      endpointIndex: null,
      idleSeen: false,
    });
    const initial = pager.state;
    for (const event of [
      { type: 'selected', index: 0 },
      { type: 'selected', index: 2 },
      { type: 'scrollEndpoint', index: 0 },
      { type: 'idle' },
      { type: 'flushQueued' },
      { type: 'request', index: 2 },
    ] satisfies RetainedPagerTransitionEvent[]) {
      expect(pager.send(event)).toEqual([]);
      expect(pager.state).toBe(initial);
    }
  });

  it.each([
    [3, -1, 3, 0],
    [3, 1.9, 3, 1],
    [3, 99, 3, 2],
    [3, Number.NaN, 3, 0],
    [3, Number.POSITIVE_INFINITY, 3, 0],
    [2.9, 2, 2, 1],
    [0, 2, 0, 0],
    [-1, 2, 0, 0],
    [Number.NaN, 2, 0, 0],
    [Number.POSITIVE_INFINITY, 2, 0, 0],
  ])(
    'normalizes page count %s and initial index %s',
    (pageCount, initialIndex, count, index) => {
      expect(
        createRetainedPagerTransition({
          platform: 'ios',
          pageCount,
          initialIndex,
        }),
      ).toMatchObject({ pageCount: count, settledIndex: index, phase: 'idle' });
    },
  );

  it.each([0, 1])('cannot start a gesture with %s pages', pageCount => {
    const pager = driver(
      createRetainedPagerTransition({
        platform: 'ios',
        pageCount,
        initialIndex: 0,
      }),
    );
    const initial = pager.state;
    expect(pager.send({ type: 'dragStart' })).toEqual([]);
    expect(pager.state).toBe(initial);
  });

  it.each([-1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores invalid request/selection/endpoint %s without changing state',
    index => {
      const pager = driver();
      for (const phase of ['idle', 'command'] as const) {
        if (phase === 'command') {
          pager.send({ type: 'request', index: 1 });
        }
        const before = pager.state;
        for (const type of ['request', 'selected', 'scrollEndpoint'] as const) {
          expect(pager.send({ type, index })).toEqual([]);
          expect(pager.state).toBe(before);
        }
      }
    },
  );
});

describe('programmatic native completion', () => {
  it('iOS finishes a command on selected without requiring an idle callback', () => {
    const pager = driver();
    expect(pager.send({ type: 'request', index: 2 })).toEqual([
      { type: 'began', sourceIndex: 0, epoch: 1 },
      { type: 'nativeCommand', index: 2, epoch: 1 },
    ]);
    expect(pager.state).toMatchObject({ phase: 'command', requestedIndex: 2 });
    expect(pager.send({ type: 'scrollEndpoint', index: 2 })).toEqual([]);
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state.phase).toBe('command');
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([
      { type: 'settled', index: 2, epoch: 2 },
    ]);
    expect(pager.state).toEqual({ ...create('ios', 2), epoch: 2 });
    const settled = pager.state;
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([]);
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state).toBe(settled);
  });

  it('Android selected before idle does not release transition geometry early', () => {
    const pager = driver(create('android'));
    pager.send({ type: 'request', index: 2 });
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([]);
    expect(pager.send({ type: 'scrollEndpoint', index: 2 })).toEqual([]);
    expect(pager.state).toMatchObject({
      phase: 'command',
      settledIndex: 0,
      selectedIndex: 2,
    });
    expect(pager.send({ type: 'idle' })).toEqual([
      { type: 'settled', index: 2, epoch: 2 },
    ]);
    expect(pager.state).toEqual({ ...create('android', 2), epoch: 2 });
  });

  it('Android can observe command idle before selected, but requires both', () => {
    const pager = driver(create('android'));
    pager.send({ type: 'request', index: 1 });
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state).toMatchObject({ phase: 'command', idleSeen: true });
    expect(pager.send({ type: 'selected', index: 1 })).toEqual([
      { type: 'settled', index: 1, epoch: 2 },
    ]);
  });

  it.each(platforms)(
    '%s ignores off-target selected during a command',
    platform => {
      const pager = driver(create(platform));
      pager.send({ type: 'request', index: 2 });
      const before = pager.state;
      expect(pager.send({ type: 'selected', index: 0 })).toEqual([]);
      expect(pager.send({ type: 'selected', index: 1 })).toEqual([]);
      expect(pager.state).toBe(before);
    },
  );
});

describe('ordered native gestures and cancellation', () => {
  it.each(platforms)(
    '%s captures geometry once per drag and ignores repeated dragStart',
    platform => {
      const pager = driver(create(platform, 1));
      expect(pager.send({ type: 'dragStart' })).toEqual([
        { type: 'began', sourceIndex: 1, epoch: 1 },
      ]);
      const started = pager.state;
      expect(pager.send({ type: 'dragStart' })).toEqual([]);
      expect(pager.state).toBe(started);
    },
  );

  it.each(platforms)(
    '%s cancels a no-displacement drag without selected or another scroll event',
    platform => {
      const pager = driver(create(platform, 1));
      pager.send({ type: 'dragStart' });
      expect(pager.send({ type: 'idle' })).toEqual([
        { type: 'settled', index: 1, epoch: 2 },
      ]);
      expect(pager.state).toEqual({ ...create(platform, 1), epoch: 2 });
    },
  );

  it.each(['before', 'after'] as const)(
    'iOS cancellation accepts the source endpoint %s idle, without selected',
    order => {
      const pager = driver(create('ios', 1));
      pager.send({ type: 'dragStart' });
      pager.send({ type: 'scrollEndpoint', index: null });
      const endpoint = { type: 'scrollEndpoint', index: 1 } as const;
      const idle = { type: 'idle' } as const;
      expect(pager.send(order === 'before' ? endpoint : idle)).toEqual([]);
      expect(pager.state.phase).toBe('gesture');
      expect(pager.send(order === 'before' ? idle : endpoint)).toEqual([
        { type: 'settled', index: 1, epoch: 2 },
      ]);
    },
  );

  it('iOS does not use an obsolete endpoint after the finger leaves it again', () => {
    const pager = driver(create('ios', 1));
    pager.send({ type: 'dragStart' });
    pager.send({ type: 'scrollEndpoint', index: null });
    pager.send({ type: 'scrollEndpoint', index: 1 });
    pager.send({ type: 'scrollEndpoint', index: null });
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state).toMatchObject({ phase: 'gesture', idleSeen: true });
    expect(pager.send({ type: 'scrollEndpoint', index: 2 })).toEqual([]);
    expect(pager.state.phase).toBe('gesture');
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([
      { type: 'settled', index: 2, epoch: 2 },
    ]);
  });

  it('iOS does not let a delayed source selection finish an active gesture', () => {
    const pager = driver(create('ios', 2));
    pager.send({ type: 'dragStart' });
    pager.send({ type: 'scrollEndpoint', index: null });
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([]);
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state.phase).toBe('gesture');
    expect(pager.send({ type: 'selected', index: 1 })).toEqual([
      { type: 'settled', index: 1, epoch: 2 },
    ]);
  });

  it('iOS completed gestures settle on selected, and trailing endpoint/idle are inert', () => {
    const pager = driver();
    pager.send({ type: 'dragStart' });
    pager.send({ type: 'scrollEndpoint', index: null });
    expect(pager.send({ type: 'selected', index: 1 })).toEqual([
      { type: 'settled', index: 1, epoch: 2 },
    ]);
    const settled = pager.state;
    expect(pager.send({ type: 'scrollEndpoint', index: 1 })).toEqual([]);
    expect(pager.send({ type: 'idle' })).toEqual([]);
    expect(pager.state).toBe(settled);
  });

  it('Android selection changes during a drag settle only the latest observation at idle', () => {
    const pager = driver(create('android'));
    pager.send({ type: 'dragStart' });
    expect(pager.send({ type: 'selected', index: 1 })).toEqual([]);
    expect(pager.send({ type: 'selected', index: 2 })).toEqual([]);
    expect(pager.state.settledIndex).toBe(0);
    expect(pager.send({ type: 'idle' })).toEqual([
      { type: 'settled', index: 2, epoch: 2 },
    ]);
  });

  it('Android cancelled drag settles its source when no selection was emitted', () => {
    const pager = driver(create('android', 1));
    pager.send({ type: 'dragStart' });
    pager.send({ type: 'scrollEndpoint', index: null });
    expect(pager.send({ type: 'idle' })).toEqual([
      { type: 'settled', index: 1, epoch: 2 },
    ]);
  });

  it.each([false, true])(
    'Android command interruption retains the native selection (new selected: %s)',
    changesSelection => {
      const pager = driver(create('android'));
      pager.send({ type: 'request', index: 1 });
      pager.send({ type: 'selected', index: 1 });
      pager.send({ type: 'request', index: 2 });
      const commandEpoch = pager.state.epoch;
      expect(pager.send({ type: 'dragStart' })).toEqual([]);
      expect(pager.state).toMatchObject({
        phase: 'gesture',
        epoch: commandEpoch,
        requestedIndex: null,
        selectedIndex: 1,
        queuedIndex: 2,
        idleSeen: false,
      });
      if (changesSelection) {
        pager.send({ type: 'selected', index: 0 });
      }
      expect(pager.send({ type: 'idle' })).toEqual([
        { type: 'settled', index: changesSelection ? 0 : 1, epoch: 2 },
      ]);
      expect(pager.send({ type: 'flushQueued' })).toEqual([
        { type: 'began', sourceIndex: changesSelection ? 0 : 1, epoch: 3 },
        { type: 'nativeCommand', index: 2, epoch: 3 },
      ]);
    },
  );
});

describe('latest-request serialization and post-geometry queue drain', () => {
  it.each(platforms)(
    '%s emits one command at a time and queues only the latest click',
    platform => {
      const pager = driver(create(platform));
      pager.send({ type: 'request', index: 1 });
      for (const index of [2, 0, 2, 2]) {
        expect(pager.send({ type: 'request', index })).toEqual([]);
      }
      expect(pager.state).toMatchObject({
        requestedIndex: 1,
        queuedIndex: 2,
        epoch: 1,
      });
      expect(pager.send({ type: 'flushQueued' })).toEqual([]);
      const completion = pager.send({ type: 'selected', index: 1 });
      expect(
        platform === 'ios' ? completion : pager.send({ type: 'idle' }),
      ).toEqual([{ type: 'settled', index: 1, epoch: 2 }]);
      expect(pager.state).toMatchObject({
        phase: 'idle',
        settledIndex: 1,
        queuedIndex: 2,
      });
      // The geometry owner explicitly acknowledges the idle layout before this.
      expect(pager.send({ type: 'flushQueued' })).toEqual([
        { type: 'began', sourceIndex: 1, epoch: 3 },
        { type: 'nativeCommand', index: 2, epoch: 3 },
      ]);
      expect(pager.send({ type: 'flushQueued' })).toEqual([]);
    },
  );

  it.each(platforms)(
    '%s discards a queued request matching the completed destination',
    platform => {
      const pager = driver(create(platform));
      pager.send({ type: 'request', index: 1 });
      pager.send({ type: 'request', index: 2 });
      pager.send({ type: 'request', index: 1 });
      pager.send({ type: 'selected', index: 1 });
      if (platform === 'android') {
        pager.send({ type: 'idle' });
      }
      expect(pager.state.queuedIndex).toBeNull();
      expect(pager.send({ type: 'flushQueued' })).toEqual([]);
    },
  );

  it('a new request supersedes the old queue while idle geometry is being applied', () => {
    const pager = driver();
    pager.send({ type: 'request', index: 1 });
    pager.send({ type: 'request', index: 2 });
    pager.send({ type: 'selected', index: 1 });
    expect(pager.send({ type: 'request', index: 0 })).toEqual([
      { type: 'began', sourceIndex: 1, epoch: 3 },
      { type: 'nativeCommand', index: 0, epoch: 3 },
    ]);
    expect(pager.state.queuedIndex).toBeNull();
  });

  it('clicking the settled page while idle cancels a pending queued request', () => {
    const pager = driver();
    pager.send({ type: 'request', index: 1 });
    pager.send({ type: 'request', index: 2 });
    pager.send({ type: 'selected', index: 1 });
    expect(pager.send({ type: 'request', index: 1 })).toEqual([]);
    expect(pager.state.queuedIndex).toBeNull();
    expect(pager.send({ type: 'flushQueued' })).toEqual([]);
  });

  it.each(platforms)(
    '%s queues tab clicks during a drag and drains after cancellation',
    platform => {
      const pager = driver(create(platform));
      pager.send({ type: 'dragStart' });
      pager.send({ type: 'scrollEndpoint', index: null });
      expect(pager.send({ type: 'request', index: 1 })).toEqual([]);
      expect(pager.send({ type: 'request', index: 2 })).toEqual([]);
      pager.send({ type: 'scrollEndpoint', index: 0 });
      expect(pager.send({ type: 'idle' })).toEqual([
        { type: 'settled', index: 0, epoch: 2 },
      ]);
      expect(pager.send({ type: 'flushQueued' })).toEqual([
        { type: 'began', sourceIndex: 0, epoch: 3 },
        { type: 'nativeCommand', index: 2, epoch: 3 },
      ]);
    },
  );
});

describe('adapter work generations are not native request identity', () => {
  it.each([
    { type: 'dragStart' },
    { type: 'selected', index: 1 },
    { type: 'scrollEndpoint', index: 1 },
    { type: 'idle' },
  ] satisfies RetainedPagerTransitionEvent[])(
    'rejects already-enqueued adapter work from an obsolete epoch: $type',
    event => {
      const pager = driver();
      pager.send({ type: 'request', index: 1 });
      const before = pager.state;
      expect(pager.send({ ...event, epoch: 0 })).toEqual([]);
      expect(pager.state).toBe(before);
    },
  );

  it('does not pretend the current epoch can identify a selected native callback', () => {
    const pager = driver();
    pager.send({ type: 'request', index: 1 });
    // Real PagerView selected events have no epoch/request id. A matching
    // selected must be accepted, even if a caller stamps the current epoch.
    expect(
      pager.send({ type: 'selected', index: 1, epoch: pager.state.epoch }),
    ).toEqual([{ type: 'settled', index: 1, epoch: 2 }]);
  });

  it('keeps frozen input immutable across the complete lifecycle', () => {
    const initial = Object.freeze(create());
    const started = reduceRetainedPagerTransition(initial, {
      type: 'request',
      index: 2,
    });
    const command = Object.freeze(started.state);
    const finished = reduceRetainedPagerTransition(command, {
      type: 'selected',
      index: 2,
    });
    expect(initial).toEqual(create());
    expect(command).toMatchObject({
      phase: 'command',
      settledIndex: 0,
      requestedIndex: 2,
    });
    expect(finished.state).toEqual({ ...create('ios', 2), epoch: 2 });
  });
});
