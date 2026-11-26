import { MultiHomeFeatTitle } from '@/constant/newStyle';

/**
 * Where a Home feature card lives: the first floor ("home") or the "More
 * Features" tab of the second floor ("more").
 */
export type HomeFeaturePlace = 'home' | 'more';

/** The cards the user moved, in display order. Pinned cards are not stored. */
export type HomeFeatureLayout = Record<HomeFeaturePlace, MultiHomeFeatTitle[]>;

/** Always on Home, always first, never editable. */
export const HOME_PINNED_FEATURES: readonly MultiHomeFeatTitle[] = [
  MultiHomeFeatTitle.Swap,
  MultiHomeFeatTitle.Bridge,
  MultiHomeFeatTitle.Send,
  MultiHomeFeatTitle.Receive,
  MultiHomeFeatTitle.Perps,
  MultiHomeFeatTitle.MemeCoin,
];

/** Cards the user can move between the two floors, in their default order. */
export const HOME_MOVABLE_FEATURES: readonly MultiHomeFeatTitle[] = [
  MultiHomeFeatTitle.GasAccount,
  MultiHomeFeatTitle.History,
  MultiHomeFeatTitle.Market,
  MultiHomeFeatTitle.Approvals,
  MultiHomeFeatTitle.Points,
  MultiHomeFeatTitle.ConvertDust,
  MultiHomeFeatTitle.Lending,
];

/** Movable cards that start on the second floor. */
const DEFAULT_MORE_FEATURES: readonly MultiHomeFeatTitle[] = [
  MultiHomeFeatTitle.GasAccount,
  MultiHomeFeatTitle.Approvals,
];

const MOVABLE_FEATURE_SET = new Set<MultiHomeFeatTitle>(HOME_MOVABLE_FEATURES);
const DEFAULT_MORE_FEATURE_SET = new Set<MultiHomeFeatTitle>(
  DEFAULT_MORE_FEATURES,
);

export function isHomeFeatureMovable(key: MultiHomeFeatTitle) {
  return MOVABLE_FEATURE_SET.has(key);
}

export function getDefaultHomeFeatureLayout(): HomeFeatureLayout {
  return {
    home: HOME_MOVABLE_FEATURES.filter(
      key => !DEFAULT_MORE_FEATURE_SET.has(key),
    ),
    more: HOME_MOVABLE_FEATURES.filter(key =>
      DEFAULT_MORE_FEATURE_SET.has(key),
    ),
  };
}

function pickKnownKeys(input: unknown, seen: Set<MultiHomeFeatTitle>) {
  const result: MultiHomeFeatTitle[] = [];
  if (!Array.isArray(input)) {
    return result;
  }

  for (const key of input) {
    if (!MOVABLE_FEATURE_SET.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }

  return result;
}

/**
 * Make a persisted layout safe to render: unknown or duplicated keys are
 * dropped, and a movable card the stored layout does not know yet (a feature
 * added by a later release) is appended to the floor it starts on.
 */
export function normalizeHomeFeatureLayout(input: unknown): HomeFeatureLayout {
  const stored = (input && typeof input === 'object' ? input : {}) as Partial<
    Record<HomeFeaturePlace, unknown>
  >;
  const seen = new Set<MultiHomeFeatTitle>();
  const layout: HomeFeatureLayout = {
    home: pickKnownKeys(stored.home, seen),
    more: pickKnownKeys(stored.more, seen),
  };

  for (const key of HOME_MOVABLE_FEATURES) {
    if (seen.has(key)) {
      continue;
    }
    layout[DEFAULT_MORE_FEATURE_SET.has(key) ? 'more' : 'home'].push(key);
  }

  return layout;
}

export function isSameHomeFeatureLayout(
  a: HomeFeatureLayout,
  b: HomeFeatureLayout,
) {
  return (['home', 'more'] as const).every(
    place =>
      a[place].length === b[place].length &&
      a[place].every((key, index) => key === b[place][index]),
  );
}

/**
 * Move a card to the other floor. It lands first among the movable cards
 * there, which is where the design drops it. Returns the same object when
 * nothing changes so store subscribers are not notified.
 */
export function moveHomeFeature(
  layout: HomeFeatureLayout,
  key: MultiHomeFeatTitle,
  to: HomeFeaturePlace,
): HomeFeatureLayout {
  if (!isHomeFeatureMovable(key)) {
    return layout;
  }

  const from: HomeFeaturePlace = to === 'home' ? 'more' : 'home';
  if (!layout[from].includes(key)) {
    return layout;
  }

  return {
    ...layout,
    [from]: layout[from].filter(item => item !== key),
    [to]: [key, ...layout[to].filter(item => item !== key)],
  };
}
