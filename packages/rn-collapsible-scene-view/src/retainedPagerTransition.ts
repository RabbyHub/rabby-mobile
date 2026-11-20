export type RetainedPagerPlatform = 'android' | 'ios';

export type RetainedPagerTransitionState = {
  platform: RetainedPagerPlatform;
  pageCount: number;
  settledIndex: number;
  phase: 'idle' | 'gesture' | 'command';
  epoch: number;
  requestedIndex: number | null;
  queuedIndex: number | null;
  selectedIndex: number | null;
  endpointIndex: number | null;
  idleSeen: boolean;
};

type NativeEventEpoch = {
  /** Only fences already-enqueued adapter work. PagerView native events do not
   * contain a request id; assigning the current epoch cannot identify them.
   */
  epoch?: number;
};

export type RetainedPagerTransitionEvent =
  | { type: 'request'; index: number }
  | { type: 'flushQueued' }
  | ({ type: 'dragStart' } & NativeEventEpoch)
  | ({ type: 'selected'; index: number } & NativeEventEpoch)
  | ({ type: 'scrollEndpoint'; index: number | null } & NativeEventEpoch)
  | ({ type: 'idle' } & NativeEventEpoch);

export type RetainedPagerTransitionEffect =
  | { type: 'began'; sourceIndex: number; epoch: number }
  | { type: 'nativeCommand'; index: number; epoch: number }
  | { type: 'settled'; index: number; epoch: number };

export type RetainedPagerTransitionResult = {
  state: RetainedPagerTransitionState;
  effects: RetainedPagerTransitionEffect[];
};

export function createRetainedPagerTransition({
  platform,
  pageCount,
  initialIndex,
}: {
  platform: RetainedPagerPlatform;
  pageCount: number;
  initialIndex: number;
}): RetainedPagerTransitionState {
  const count = Number.isFinite(pageCount)
    ? Math.max(0, Math.trunc(pageCount))
    : 0;
  return {
    platform,
    pageCount: count,
    settledIndex: Number.isFinite(initialIndex)
      ? Math.min(Math.max(0, count - 1), Math.max(0, Math.trunc(initialIndex)))
      : 0,
    phase: 'idle',
    epoch: 0,
    requestedIndex: null,
    queuedIndex: null,
    selectedIndex: null,
    endpointIndex: null,
    idleSeen: false,
  };
}

const unchanged = (
  state: RetainedPagerTransitionState,
): RetainedPagerTransitionResult => ({ state, effects: [] });

const validIndex = (state: RetainedPagerTransitionState, index: number) =>
  Number.isInteger(index) && index >= 0 && index < state.pageCount;

function beginCommand(
  state: RetainedPagerTransitionState,
  index: number,
): RetainedPagerTransitionResult {
  const epoch = state.epoch + 1;
  return {
    state: {
      ...state,
      phase: 'command',
      epoch,
      requestedIndex: index,
      queuedIndex: null,
      selectedIndex: null,
      endpointIndex: null,
      idleSeen: false,
    },
    effects: [
      { type: 'began', sourceIndex: state.settledIndex, epoch },
      { type: 'nativeCommand', index, epoch },
    ],
  };
}

function settle(
  state: RetainedPagerTransitionState,
  index: number,
): RetainedPagerTransitionResult {
  const epoch = state.epoch + 1;
  return {
    state: {
      ...state,
      settledIndex: index,
      phase: 'idle',
      epoch,
      requestedIndex: null,
      queuedIndex: state.queuedIndex === index ? null : state.queuedIndex,
      selectedIndex: null,
      endpointIndex: null,
      idleSeen: false,
    },
    // Do not start another command until the owner applies the idle geometry.
    effects: [{ type: 'settled', index, epoch }],
  };
}

/** Pure native-pager lifecycle protocol, not an animation or scroll scheduler.
 * iOS reports programmatic completion through selected, without requiring idle.
 * Android selected may precede animation completion, so it waits for idle.
 * The owner drains a queued request only after applying the new idle geometry.
 * Keep all native lifecycle observations ordered in the adapter. Only endpoint
 * transitions need JS publication: dispatch null when leaving an endpoint.
 */
export function reduceRetainedPagerTransition(
  state: RetainedPagerTransitionState,
  event: RetainedPagerTransitionEvent,
): RetainedPagerTransitionResult {
  if (
    'epoch' in event &&
    event.epoch !== undefined &&
    event.epoch !== state.epoch
  ) {
    return unchanged(state);
  }

  switch (event.type) {
    case 'request':
      if (!validIndex(state, event.index)) {
        return unchanged(state);
      }
      if (state.phase !== 'idle') {
        return state.queuedIndex === event.index
          ? unchanged(state)
          : unchanged({ ...state, queuedIndex: event.index });
      }
      if (event.index === state.settledIndex) {
        return state.queuedIndex === null
          ? unchanged(state)
          : unchanged({ ...state, queuedIndex: null });
      }
      return beginCommand(state, event.index);

    case 'flushQueued':
      if (state.phase !== 'idle' || state.queuedIndex === null) {
        return unchanged(state);
      }
      return state.queuedIndex === state.settledIndex
        ? unchanged({ ...state, queuedIndex: null })
        : beginCommand(state, state.queuedIndex);

    case 'dragStart': {
      if (state.pageCount < 2 || state.phase === 'gesture') {
        return unchanged(state);
      }
      if (state.phase === 'command') {
        // Native may let the finger interrupt an Android programmatic scroll.
        // Keep its geometry snapshot and latest selection: ViewPager2 can have
        // selected the command target already, without reporting it again when
        // the interrupted drag ends on that same page.
        return unchanged({
          ...state,
          phase: 'gesture',
          requestedIndex: null,
          endpointIndex: null,
          idleSeen: false,
        });
      }
      const epoch = state.epoch + 1;
      return {
        state: {
          ...state,
          phase: 'gesture',
          epoch,
          selectedIndex: null,
          // A drag with no displacement may end without another scroll event.
          // Departure observations clear this known source endpoint; idle
          // alone must not complete a gesture that is between pages.
          endpointIndex: state.settledIndex,
          idleSeen: false,
        },
        effects: [{ type: 'began', sourceIndex: state.settledIndex, epoch }],
      };
    }

    case 'selected': {
      if (
        !validIndex(state, event.index) ||
        state.phase === 'idle' ||
        (state.phase === 'command' && event.index !== state.requestedIndex)
      ) {
        // Initial/duplicate selected events are observations, not user intent.
        return unchanged(state);
      }
      if (state.platform === 'ios') {
        // iOS cancelled gestures do not report selected; a source selection can
        // be a delayed mount notification and cannot complete a new gesture.
        return state.phase === 'gesture' && event.index === state.settledIndex
          ? unchanged(state)
          : settle(state, event.index);
      }
      return state.idleSeen
        ? settle(state, event.index)
        : unchanged({ ...state, selectedIndex: event.index });
    }

    case 'scrollEndpoint': {
      if (
        state.phase === 'idle' ||
        (event.index !== null && !validIndex(state, event.index))
      ) {
        return unchanged(state);
      }
      const next = { ...state, endpointIndex: event.index };
      return state.platform === 'ios' &&
        state.phase === 'gesture' &&
        state.idleSeen &&
        event.index === state.settledIndex
        ? settle(next, state.settledIndex)
        : state.endpointIndex === event.index
        ? unchanged(state)
        : unchanged(next);
    }

    case 'idle':
      if (state.phase === 'idle') {
        return unchanged(state);
      }
      if (state.platform === 'android') {
        if (state.selectedIndex !== null) {
          return settle(state, state.selectedIndex);
        }
        return state.phase === 'gesture'
          ? settle(state, state.settledIndex)
          : unchanged({ ...state, idleSeen: true });
      }
      if (state.phase === 'command') {
        return unchanged(state);
      }
      return state.endpointIndex === state.settledIndex
        ? settle(state, state.settledIndex)
        : unchanged({ ...state, idleSeen: true });
  }
}
