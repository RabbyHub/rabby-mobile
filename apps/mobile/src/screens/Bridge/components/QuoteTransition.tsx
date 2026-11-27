import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { quoteTransitionToken } from '../state/quoteTransitionControl';

const FLUX_MIN_OPACITY = 0.45;
const FLUX_DIP_MS = 200;
const FLUX_RECOVER_MS = 200;
const FLUX_TAIL_MS = 150;

const SWAP_OUT_MS = 100;
const SWAP_IN_MS = 140;

const easeOutQuad = Easing.out(Easing.quad);

/**
 * Opacity "breathing" for the values that are affected by the quote source.
 *
 * It never runs on the JS thread: the transition token is written once by JS
 * when the best quote switches source, and every consumer reacts to the same
 * shared value, so they all start on the same frame. A loading/empty value
 * opts out through `enabled`, so a placeholder is never animated.
 */
export function useQuoteFluxStyle(enabled: boolean) {
  const opacity = useSharedValue(1);
  const enabledSv = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    enabledSv.value = enabled ? 1 : 0;
    if (enabled) {
      return;
    }
    cancelAnimation(opacity);
    opacity.value = withTiming(1, { duration: 160, easing: easeOutQuad });
  }, [enabled, enabledSv, opacity]);

  useAnimatedReaction(
    () => quoteTransitionToken.value,
    (token, previousToken) => {
      if (previousToken === null || token === previousToken) {
        return;
      }
      if (!enabledSv.value) {
        return;
      }
      // Bounded sequence: dip, recover, short tail. A new token restarts it
      // from the current opacity, so consecutive source switches chain instead
      // of jumping back to fully opaque.
      opacity.value = withSequence(
        withTiming(FLUX_MIN_OPACITY, {
          duration: FLUX_DIP_MS,
          easing: easeOutQuad,
        }),
        withTiming(1, { duration: FLUX_RECOVER_MS, easing: easeOutQuad }),
        withTiming(1, { duration: FLUX_TAIL_MS }),
      );
    },
  );

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** Wrapper that applies the quote flux to its children (value only, not label). */
export const QuoteFlux = ({
  enabled,
  style,
  children,
}: React.PropsWithChildren<{
  enabled: boolean;
  style?: StyleProp<ViewStyle>;
}>) => {
  const animatedStyle = useQuoteFluxStyle(enabled);
  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
};

type SourceLayer = { key: string; node: React.ReactNode };

/**
 * Cross-fades the "best quote source" row when the source actually changes.
 *
 * Both layers are rendered by React (content itself is JS by nature), but the
 * visibility of both is driven by UI-thread shared values, so the old source is
 * fully faded out before the new one is shown and there is no JS callback in
 * the middle of the animation.
 */
export const QuoteSourceSwap = ({
  triggerKey,
  style,
  children,
}: React.PropsWithChildren<{
  triggerKey: string;
  style?: StyleProp<ViewStyle>;
}>) => {
  const [displayedKey, setDisplayedKey] = useState(triggerKey);
  const [leaving, setLeaving] = useState<SourceLayer | null>(null);
  const inOpacity = useSharedValue(1);
  const outOpacity = useSharedValue(0);
  // The in-flow layer always renders the latest content (so same-source value
  // updates apply immediately); the outgoing layer is a one-shot snapshot taken
  // when the source changes, so no element identity is ever stored in state.
  const lastNodeRef = useRef<React.ReactNode>(children);

  useLayoutEffect(() => {
    if (displayedKey === triggerKey) {
      lastNodeRef.current = children;
      return;
    }
    // Only quoted -> quoted transitions animate; entering/leaving an empty
    // state (no quote yet / no quote found) swaps instantly.
    if (!displayedKey || !triggerKey) {
      setLeaving(null);
      setDisplayedKey(triggerKey);
      lastNodeRef.current = children;
      return;
    }
    setLeaving({ key: displayedKey, node: lastNodeRef.current });
    setDisplayedKey(triggerKey);
    lastNodeRef.current = children;
  }, [children, displayedKey, triggerKey]);

  // A new layer pair was committed: start the cross-fade in this commit so the
  // first painted frame still looks like the old content.
  useLayoutEffect(() => {
    if (!leaving) {
      inOpacity.value = 1;
      return;
    }

    inOpacity.value = 0;
    outOpacity.value = 1;
    inOpacity.value = withTiming(1, {
      duration: SWAP_IN_MS,
      easing: easeOutQuad,
    });
    outOpacity.value = withTiming(
      0,
      { duration: SWAP_OUT_MS, easing: easeOutQuad },
      finished => {
        if (finished) {
          runOnJS(setLeaving)(null);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedKey, leaving?.key]);

  const inStyle = useAnimatedStyle(() => ({ opacity: inOpacity.value }));
  const outStyle = useAnimatedStyle(() => ({ opacity: outOpacity.value }));

  return (
    <View style={style}>
      <Animated.View style={inStyle}>{children}</Animated.View>
      {leaving ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            },
            outStyle,
          ]}>
          {leaving.node}
        </Animated.View>
      ) : null}
    </View>
  );
};
