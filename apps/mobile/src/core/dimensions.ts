import { Dimensions as RNDimensions } from 'react-native';
import type { ScaledSize } from 'react-native';
import { useWindowDimensions as useRNWindowDimensions } from 'react-native';

import { svsLayout } from '@/hooks/useAppLayout';

/**
 * App-level `Dimensions` facade.
 *
 * Consumers should import from here instead of `react-native`:
 *
 *   import { Dimensions, useWindowDimensions } from '@/core/dimensions';
 *
 * `svsLayout` is the app's single layout mutable: it starts from the native
 * window size and is updated on every `Dimensions` change, which includes the
 * reduced width `SafeWindowFrame` publishes while a foldable system column is
 * present. Reading through it keeps React code and worklets on the same number;
 * on a plain phone the values are identical to React Native's.
 */
export const Dimensions = {
  get(dim: 'window' | 'screen'): ScaledSize {
    return dim === 'screen'
      ? svsLayout.screenLayout.value
      : svsLayout.winLayout.value;
  },
  addEventListener: RNDimensions.addEventListener.bind(RNDimensions),
};

export const useWindowDimensions = useRNWindowDimensions;
