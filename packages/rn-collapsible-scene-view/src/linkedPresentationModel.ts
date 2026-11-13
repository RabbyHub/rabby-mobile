import {
  resolveLinkedScenePath,
  type LinkedSceneLeaf,
  type LinkedSceneModel,
  type LinkedScenePagingMode,
  type LinkedScenePath,
} from './linkedSceneModel';

/** One visual edge is owned by either the root track or one child track. */
export type LinkedPresentationEdge = {
  readonly fromPath: LinkedScenePath;
  readonly toPath: LinkedScenePath;
  readonly scope: 'root' | 'child';
  readonly direction: -1 | 1;
  readonly fromRootIndex: number;
  readonly toRootIndex: number;
  readonly fromChildIndex?: number;
  readonly toChildIndex?: number;
  /** Snapshot by root index, not live memory, including intermediate roots. */
  readonly frozenChildPositions: readonly number[];
};

type LinkedPresentationResolution = {
  model: LinkedSceneModel;
  fromPath: LinkedScenePath;
  remembered?: Readonly<Record<string, string>>;
};

const clampFraction = (fraction: number): number => {
  'worklet';

  return Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
};

const resolveLeaf = (
  model: LinkedSceneModel,
  path: LinkedScenePath,
  remembered?: Readonly<Record<string, string>>,
): LinkedSceneLeaf => {
  'worklet';

  const resolved = resolveLinkedScenePath(model, path, remembered);
  return model.leaves.find(
    leaf =>
      leaf.path.key === resolved.key &&
      leaf.path.childKey === resolved.childKey,
  )!;
};

const createEdge = (
  model: LinkedSceneModel,
  from: LinkedSceneLeaf,
  to: LinkedSceneLeaf,
  remembered?: Readonly<Record<string, string>>,
): LinkedPresentationEdge | null => {
  'worklet';

  if (from.index === to.index) {
    return null;
  }
  const scope = from.rootIndex === to.rootIndex ? 'child' : 'root';
  const fromIndex = scope === 'root' ? from.rootIndex : from.childIndex!;
  const toIndex = scope === 'root' ? to.rootIndex : to.childIndex!;
  const frozenChildPositions = model.roots.map(sceneRoot => {
    if (sceneRoot.rootIndex === from.rootIndex) {
      return from.childIndex ?? 0;
    }
    if (sceneRoot.rootIndex === to.rootIndex) {
      return to.childIndex ?? 0;
    }
    return (
      resolveLeaf(model, { key: sceneRoot.key }, remembered).childIndex ?? 0
    );
  });
  return {
    fromPath: from.path,
    toPath: to.path,
    scope,
    direction: toIndex > fromIndex ? 1 : -1,
    fromRootIndex: from.rootIndex,
    toRootIndex: to.rootIndex,
    fromChildIndex: from.childIndex,
    toChildIndex: to.childIndex,
    frozenChildPositions,
  };
};

/**
 * Flat gestures prefer adjacent children regardless of the touch region, then
 * cross a root boundary using that root's remembered child (or its first child).
 * Precise/nested gestures stay in the touched child track, including at its
 * boundaries; outside that region only the root track participates.
 * @param options0 - Captured routing inputs.
 * @param options0.model - Validated logical topology.
 * @param options0.fromPath - Current settled path.
 * @param options0.direction - Next child/root is positive, previous is negative.
 * @param options0.pagingMode - Flat child-first or precise content routing.
 * @param options0.childEligible - Whether the gesture began in child content.
 * @param options0.remembered - Last selected child by root key.
 * @returns One available visual edge, or null at the selected track boundary.
 */
export const resolveLinkedPresentationGestureEdge = ({
  model,
  fromPath,
  direction,
  pagingMode,
  childEligible,
  remembered,
}: LinkedPresentationResolution & {
  direction: -1 | 1;
  pagingMode: LinkedScenePagingMode;
  childEligible: boolean;
}): LinkedPresentationEdge | null => {
  'worklet';

  const from = resolveLeaf(model, fromPath, remembered);
  if (
    (pagingMode === 'flat' || childEligible) &&
    from.childIndex !== undefined
  ) {
    const to = model.roots[from.rootIndex].leaves[from.childIndex + direction];
    if (to) {
      return createEdge(model, from, to, remembered);
    }
    if (pagingMode === 'nested') {
      return null;
    }
  }
  const sceneRoot = model.roots[from.rootIndex + direction];
  return sceneRoot
    ? createEdge(
        model,
        from,
        resolveLeaf(model, { key: sceneRoot.key }, remembered),
        remembered,
      )
    : null;
};

/**
 * A tab click is one direct visual edge, not a walk through flattened leaves.
 * Parent-only requests recover the remembered child; explicit children win.
 * @param options0 - Captured command inputs.
 * @param options0.model - Validated logical topology.
 * @param options0.fromPath - Current settled path.
 * @param options0.toPath - Explicit leaf or parent tab request.
 * @param options0.remembered - Last selected child by root key.
 * @returns One direct visual edge, or null for the same resolved leaf.
 */
export const createLinkedPresentationCommandEdge = ({
  model,
  fromPath,
  toPath,
  remembered,
}: LinkedPresentationResolution & {
  toPath: LinkedScenePath;
}): LinkedPresentationEdge | null => {
  'worklet';

  return createEdge(
    model,
    resolveLeaf(model, fromPath, remembered),
    resolveLeaf(model, toPath, remembered),
    remembered,
  );
};

export const getLinkedPresentationRootPosition = (
  edge: LinkedPresentationEdge,
  fraction: number,
): number => {
  'worklet';

  return (
    edge.fromRootIndex +
    (edge.toRootIndex - edge.fromRootIndex) * clampFraction(fraction)
  );
};

/**
 * A root transition never animates any child track, including its destination.
 * @param edge - Captured visual transition.
 * @param rootIndex - Index of the child track's root.
 * @param fraction - Current fractional progress along this edge.
 * @returns Child index, fractional only for the edge's active child track.
 */
export const getLinkedPresentationChildPosition = (
  edge: LinkedPresentationEdge,
  rootIndex: number,
  fraction: number,
): number => {
  'worklet';

  if (edge.scope === 'child' && rootIndex === edge.fromRootIndex) {
    return (
      edge.fromChildIndex! +
      (edge.toChildIndex! - edge.fromChildIndex!) * clampFraction(fraction)
    );
  }
  return edge.frozenChildPositions[rootIndex] ?? 0;
};

const edgeSpan = (edge: LinkedPresentationEdge): number => {
  'worklet';

  return Math.abs(
    edge.scope === 'root'
      ? edge.toRootIndex - edge.fromRootIndex
      : edge.toChildIndex! - edge.fromChildIndex!,
  );
};

/**
 * Capturing an in-flight animation keeps its exact edge and fractional origin.
 * Translation is relative to that new touch, not to the old settled page.
 * One gesture is bounded to this edge; reversal cannot skip another page.
 * @param options0 - Captured gesture and live translation.
 * @param options0.edge - Existing edge, including one grabbed during animation.
 * @param options0.startFraction - Exact fraction captured on touch start.
 * @param options0.translationX - Finger displacement since that touch start.
 * @param options0.width - One visual page's width.
 * @returns Clamped fractional progress without rounding the captured origin.
 */
export const getLinkedPresentationDragFraction = ({
  edge,
  startFraction,
  translationX,
  width,
}: {
  edge: LinkedPresentationEdge;
  startFraction: number;
  translationX: number;
  width: number;
}): number => {
  'worklet';

  const start = clampFraction(startFraction);
  const distance = width * edgeSpan(edge);
  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(translationX)
  ) {
    return start;
  }
  return clampFraction(start - (translationX * edge.direction) / distance);
};

/**
 * Preserve the existing settled-start distance/fling thresholds. A gesture
 * grabbing a fractional animation instead settles to its nearest endpoint,
 * unless a meaningful final fling deliberately reverses that decision.
 * @param options0 - Gesture release inputs.
 * @param options0.edge - Existing visual edge.
 * @param options0.startFraction - Exact fraction captured on touch start.
 * @param options0.fraction - Current preview fraction at release.
 * @param options0.translationX - Finger displacement since touch start.
 * @param options0.velocityX - Final horizontal velocity in pixels per second.
 * @param options0.width - One visual page's width.
 * @returns Source endpoint zero or destination endpoint one.
 */
export const resolveLinkedPresentationEndpoint = ({
  edge,
  startFraction,
  fraction,
  translationX,
  velocityX,
  width,
}: {
  edge: LinkedPresentationEdge;
  startFraction: number;
  fraction: number;
  translationX: number;
  velocityX: number;
  width: number;
}): 0 | 1 => {
  'worklet';

  const start = clampFraction(startFraction);
  const current = clampFraction(fraction);
  const validWidth = Number.isFinite(width) && width > 0;
  const isFling =
    validWidth &&
    Number.isFinite(translationX) &&
    Math.abs(translationX) >= 12 &&
    Number.isFinite(velocityX) &&
    Math.abs(velocityX) >= 600;
  if (isFling) {
    return -velocityX * edge.direction > 0 ? 1 : 0;
  }
  if (start === 0) {
    return current >= 0.25 ? 1 : 0;
  }
  if (start === 1) {
    return current <= 0.75 ? 0 : 1;
  }
  return current >= 0.5 ? 1 : 0;
};
