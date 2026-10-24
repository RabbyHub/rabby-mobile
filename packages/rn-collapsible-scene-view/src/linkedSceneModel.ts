/** The logical hierarchy is intentionally bounded to a root and one child level. */
export type LinkedScenePage = {
  readonly key: string;
  readonly children?: readonly { readonly key: string }[];
};

export type LinkedScenePath = {
  readonly key: string;
  readonly childKey?: string;
};

export type LinkedScenePagingMode = 'flat' | 'nested';

export type LinkedSceneLeaf = {
  readonly path: LinkedScenePath;
  readonly physicalKey: string;
  readonly index: number;
  readonly rootIndex: number;
  readonly childIndex?: number;
};

export type LinkedSceneRoot = {
  readonly key: string;
  readonly rootIndex: number;
  readonly leaves: readonly LinkedSceneLeaf[];
  readonly firstLeafIndex: number;
  readonly lastLeafIndex: number;
};

/** Plain arrays and records can be captured by UI-thread worklets. */
export type LinkedSceneModel = {
  readonly roots: readonly LinkedSceneRoot[];
  readonly leaves: readonly LinkedSceneLeaf[];
  readonly topologyKey: string;
};

/**
 * JSON tuples keep parent-only keys distinct from every parent/child pair.
 * @param path - Logical page identity.
 * @returns Collision-free identity for a physical leaf.
 */
export const linkedScenePhysicalKey = (path: LinkedScenePath): string => {
  'worklet';

  return JSON.stringify(
    path.childKey === undefined ? [path.key] : [path.key, path.childKey],
  );
};

/**
 * Page existence is declared by the caller, never inferred from its row count.
 * An omitted or empty children array is one root leaf, not a missing page.
 * @param pages - Ordered logical pages with at most one child level.
 * @returns Canonical hierarchy and ordered physical leaves.
 */
export const buildLinkedSceneModel = (
  pages: readonly LinkedScenePage[],
): LinkedSceneModel => {
  if (!pages.length) {
    throw new Error('LinkedScenePager requires at least one page');
  }

  const leaves: LinkedSceneLeaf[] = [];
  const rootKeys = new Set<string>();
  const roots = pages.map((page, rootIndex): LinkedSceneRoot => {
    if (typeof page.key !== 'string' || !page.key.length) {
      throw new Error('LinkedScenePager requires non-empty page keys');
    }
    if (rootKeys.has(page.key)) {
      throw new Error('LinkedScenePager requires unique root page keys');
    }
    rootKeys.add(page.key);

    if (page.children !== undefined && !Array.isArray(page.children)) {
      throw new Error('LinkedScenePager children must be an array');
    }
    const children = page.children ?? [];
    const childKeys = new Set<string>();
    const firstLeafIndex = leaves.length;
    const rootLeaves: LinkedSceneLeaf[] = children.length
      ? children.map((child, childIndex): LinkedSceneLeaf => {
          if (typeof child.key !== 'string' || !child.key.length) {
            throw new Error('LinkedScenePager requires non-empty child keys');
          }
          if (childKeys.has(child.key)) {
            throw new Error('LinkedScenePager requires unique sibling keys');
          }
          if ('children' in child && child.children !== undefined) {
            throw new Error('LinkedScenePager supports at most two levels');
          }
          childKeys.add(child.key);
          const path = { key: page.key, childKey: child.key };
          return {
            path,
            physicalKey: linkedScenePhysicalKey(path),
            index: firstLeafIndex + childIndex,
            rootIndex,
            childIndex,
          };
        })
      : [
          {
            path: { key: page.key },
            physicalKey: linkedScenePhysicalKey({ key: page.key }),
            index: firstLeafIndex,
            rootIndex,
          },
        ];
    leaves.push(...rootLeaves);
    return {
      key: page.key,
      rootIndex,
      leaves: rootLeaves,
      firstLeafIndex,
      lastLeafIndex: leaves.length - 1,
    };
  });

  return {
    roots,
    leaves,
    topologyKey: JSON.stringify(leaves.map(leaf => leaf.physicalKey)),
  };
};

/**
 * Resolve a parent-tab click through its remembered child. Exact valid child
 * requests (including native swipe settlement) always win over that memory.
 * Removed roots/children converge deterministically to an existing leaf.
 * @param model - Validated logical topology.
 * @param path - Requested logical page, optionally specifying its child.
 * @param remembered - Last selected child by root key.
 * @returns An existing canonical leaf path.
 */
export const resolveLinkedScenePath = (
  model: LinkedSceneModel,
  path: LinkedScenePath,
  remembered?: Readonly<Record<string, string>>,
): LinkedScenePath => {
  'worklet';

  const sceneRoot = model.roots.find(item => item.key === path.key);
  if (!sceneRoot) {
    return model.leaves[0].path;
  }
  const exact = sceneRoot.leaves.find(
    leaf => leaf.path.childKey === path.childKey,
  );
  if (exact) {
    return exact.path;
  }
  const rememberedChild =
    remembered &&
    Object.prototype.hasOwnProperty.call(remembered, sceneRoot.key)
      ? remembered[sceneRoot.key]
      : undefined;
  const previous = sceneRoot.leaves.find(
    leaf => leaf.path.childKey === rememberedChild,
  );
  return (previous ?? sceneRoot.leaves[0]).path;
};

export const physicalKeyForPath = (
  model: LinkedSceneModel,
  path: LinkedScenePath,
  remembered?: Readonly<Record<string, string>>,
): string => {
  'worklet';

  return linkedScenePhysicalKey(
    resolveLinkedScenePath(model, path, remembered),
  );
};

/**
 * Unknown/stale native page keys must not be silently committed as page zero.
 * @param model - Validated logical topology.
 * @param physicalKey - Exact physical identity supplied by the native pager.
 * @returns Existing logical path, or undefined for an unknown identity.
 */
export const pathForPhysicalKey = (
  model: LinkedSceneModel,
  physicalKey: string,
): LinkedScenePath | undefined => {
  'worklet';

  return model.leaves.find(leaf => leaf.physicalKey === physicalKey)?.path;
};

const clampLinkedSceneProgress = (
  model: LinkedSceneModel,
  progress: number,
): number => {
  'worklet';

  return Number.isFinite(progress)
    ? Math.max(0, Math.min(progress, model.leaves.length - 1))
    : 0;
};

/**
 * Physical [Positions, Basic, Conditional, Account] maps to [0, 1, 1, 2].
 * @param model - Validated logical topology.
 * @param progress - Fractional physical leaf index.
 * @returns Fractional logical root index for the main tab indicator.
 */
export const projectLinkedSceneProgress = (
  model: LinkedSceneModel,
  progress: number,
): number => {
  'worklet';

  const clamped = clampLinkedSceneProgress(model, progress);
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, model.leaves.length - 1);
  const from = model.leaves[lower].rootIndex;
  const to = model.leaves[upper].rootIndex;
  return from + (to - from) * (clamped - lower);
};

/**
 * Only use this projection for a visible group; inactive selection comes from
 * remembered child state, not from the global track's distant position.
 * @param model - Validated logical topology.
 * @param rootKey - Logical root whose child indicator is being projected.
 * @param progress - Fractional physical leaf index.
 * @returns Clamped fractional child index, or undefined for a plain root.
 */
export const projectLinkedSceneChildProgress = (
  model: LinkedSceneModel,
  rootKey: string,
  progress: number,
): number | undefined => {
  'worklet';

  const sceneRoot = model.roots.find(item => item.key === rootKey);
  if (!sceneRoot || sceneRoot.leaves[0].childIndex === undefined) {
    return undefined;
  }
  return Math.max(
    0,
    Math.min(
      clampLinkedSceneProgress(model, progress) - sceneRoot.firstLeafIndex,
      sceneRoot.lastLeafIndex - sceneRoot.firstLeafIndex,
    ),
  );
};
