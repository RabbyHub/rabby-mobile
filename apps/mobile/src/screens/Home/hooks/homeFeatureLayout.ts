import type { MultiHomeFeatTitle } from '@/constant/newStyle';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';
import {
  getDefaultHomeFeatureLayout,
  isSameHomeFeatureLayout,
  moveHomeFeature,
  normalizeHomeFeatureLayout,
  type HomeFeatureLayout,
  type HomeFeaturePlace,
} from '../utils/homeFeatureLayout';

const homeFeatureLayoutStore = zustandByMMKV<HomeFeatureLayout>(
  '@home.featureLayout',
  getDefaultHomeFeatureLayout(),
  { storage: MMKVStorageStrategy.compatJson },
);

// Normalize once at load, so every selector below can hand out the stored
// arrays as they are: stable references, no per-render filtering.
const initialLayout = homeFeatureLayoutStore.getState();
const normalizedInitialLayout = normalizeHomeFeatureLayout(initialLayout);
if (!isSameHomeFeatureLayout(initialLayout, normalizedInitialLayout)) {
  homeFeatureLayoutStore.setState(normalizedInitialLayout, true);
}

/** Edit mode is a session state: it never survives a restart. */
const homeFeatureEditStore = zCreate<{ isEditing: boolean }>(() => ({
  isEditing: false,
}));

/** The movable cards of one floor, in display order. */
export function useHomeMovableFeatures(place: HomeFeaturePlace) {
  return homeFeatureLayoutStore(state => state[place]);
}

export function useHasMoreHomeFeatures() {
  return homeFeatureLayoutStore(state => state.more.length > 0);
}

export function useIsHomeFeatureEditing() {
  return homeFeatureEditStore(state => state.isEditing);
}

export const homeFeatureLayoutApi = {
  move(key: MultiHomeFeatTitle, to: HomeFeaturePlace) {
    homeFeatureLayoutStore.setState(state => moveHomeFeature(state, key, to));
  },
  isEditing() {
    return homeFeatureEditStore.getState().isEditing;
  },
  startEditing() {
    if (!homeFeatureEditStore.getState().isEditing) {
      homeFeatureEditStore.setState({ isEditing: true });
    }
  },
  stopEditing() {
    if (homeFeatureEditStore.getState().isEditing) {
      homeFeatureEditStore.setState({ isEditing: false });
    }
  },
};
