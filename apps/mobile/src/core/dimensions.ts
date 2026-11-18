import {
  Dimensions as RNDimensions,
  useWindowDimensions as useRNWindowDimensions,
} from 'react-native';
import type { ScaledSize } from 'react-native';

import { svsLayout } from '@/hooks/useAppLayout';

/**
 * App-level layout facade.
 *
 * Consumers should import from here instead of `react-native`:
 *
 *   import { getDimensionsSnapshot, useWindowDimensions } from '@/core/dimensions';
 *
 * `svsLayout` is the app's single layout mutable: it starts from the native
 * window size and is updated on every `Dimensions` change, which includes the
 * reduced width `SafeWindowFrame` publishes while a foldable system column is
 * present. On a plain phone the values are identical to React Native's.
 */

/**
 * Synchronous snapshot of the app layout.
 *
 * Reads are NOT reactive: call it from a style factory, a measurement handler
 * or a worklet body, never at module scope (the value would freeze at import
 * time) and never in a component body when the layout can change.
 */
export function getDimensionsSnapshot(dim: 'window' | 'screen'): ScaledSize {
  return dim === 'screen'
    ? svsLayout.screenLayout.value
    : svsLayout.winLayout.value;
}

/**
 * Reactive window size (the usable width: on the Duo outer screen this is the
 * letterboxed 382pt, not the native 466pt).
 *
 * This stays React Native's hook on purpose. An app-level
 * `useSyncExternalStore` reader over `svsLayout` was tried and made the
 * collapsible tab bar re-render in a loop, while React Native's own store is
 * already updated by `SafeWindowFrame` (`Dimensions.set`), so it reports the
 * same values without the extra reader.
 */
export function useWindowDimensions(): ScaledSize {
  return useRNWindowDimensions();
}

/** Subscribe to raw layout changes (window and screen arrive together). */
export function subscribeDimensionsChange(listener: () => void) {
  const subscription = RNDimensions.addEventListener('change', listener);
  return () => subscription.remove();
}
