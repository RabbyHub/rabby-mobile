/** Pure UI-thread transport state; business acceptance remains the caller's job. */
export type RootScenePagerMotion = {
  phase: 'idle' | 'touch' | 'drag' | 'snap';
  epoch: number;
  selected: number;
  target: number;
  startPosition: number;
  queued: number | null;
};

export function validateRootSceneKeys(keys: readonly string[]) {
  if (!keys.length || keys.some(key => !key || typeof key !== 'string')) {
    throw new Error('RootScenePager requires non-empty page keys');
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('RootScenePager requires unique page keys');
  }
  return JSON.stringify(keys);
}

export function createRootSceneMotion(
  selected: number,
  epoch = 0,
): RootScenePagerMotion {
  'worklet';
  return {
    phase: 'idle',
    epoch,
    selected,
    target: selected,
    startPosition: selected,
    queued: null,
  };
}

export function requestRootSceneTarget(
  state: RootScenePagerMotion,
  target: number,
): RootScenePagerMotion {
  'worklet';
  if (state.phase === 'touch' || state.phase === 'drag') {
    return { ...state, queued: target };
  }
  return {
    ...state,
    phase: 'snap',
    epoch: state.epoch + 1,
    target,
    queued: null,
  };
}

export function beginRootSceneTouch(
  state: RootScenePagerMotion,
  position: number,
): RootScenePagerMotion {
  'worklet';
  return {
    ...state,
    phase: 'touch',
    epoch: state.epoch + 1,
    startPosition: position,
    queued: null,
  };
}

export function getRootSceneDragPosition(
  start: number,
  translationX: number,
  width: number,
  count: number,
) {
  'worklet';
  if (!(width > 0) || !Number.isFinite(translationX)) {
    return start;
  }
  const exact = Math.abs(start - Math.round(start)) < 0.0001;
  const min = Math.max(0, exact ? Math.round(start) - 1 : Math.floor(start));
  const max = Math.min(
    count - 1,
    exact ? Math.round(start) + 1 : Math.ceil(start),
  );
  return Math.max(min, Math.min(max, start - translationX / width));
}

export function resolveRootSceneRelease(
  start: number,
  position: number,
  translationX: number,
  velocityX: number,
  count: number,
) {
  'worklet';
  const exact = Math.abs(start - Math.round(start)) < 0.0001;
  const fling = Math.abs(translationX) >= 12 && Math.abs(velocityX) >= 600;
  let target: number;
  if (exact) {
    target = Math.round(start);
    if (fling) {
      target += velocityX < 0 ? 1 : -1;
    } else if (Math.abs(position - start) >= 0.25) {
      target += position > start ? 1 : -1;
    }
  } else {
    target = fling
      ? velocityX < 0
        ? Math.ceil(start)
        : Math.floor(start)
      : Math.round(position);
  }
  return Math.max(0, Math.min(count - 1, target));
}

export function finishRootSceneTouch(
  state: RootScenePagerMotion,
  target: number,
): RootScenePagerMotion {
  'worklet';
  return {
    ...state,
    phase: 'snap',
    epoch: state.epoch + 1,
    target: state.queued ?? target,
    queued: null,
  };
}

export function completeRootSceneMotion(
  state: RootScenePagerMotion,
  epoch: number,
): RootScenePagerMotion {
  'worklet';
  if (state.epoch !== epoch || state.phase !== 'snap') {
    return state;
  }
  return createRootSceneMotion(state.target, epoch);
}

/** Includes every page crossed by a direct command; no frame-by-frame JS. */
export function getRootSceneVisibleRange(
  position: number,
  target: number,
  count: number,
): readonly [number, number] {
  'worklet';
  return [
    Math.max(0, Math.floor(Math.min(position, target))),
    Math.min(count - 1, Math.ceil(Math.max(position, target))),
  ];
}
