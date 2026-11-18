import React from 'react';
import {
  Dimensions,
  type ScaledSize,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme2024 } from '@/hooks/theme';
import { perfEvents } from '@/core/utils/perf';
import { isFoldableIosDevice } from '@/core/utils/foldableDevice';
import { getScreenContentBackgroundColor } from '@/constant/layout';
import {
  SafeWindowBackdropContext,
  SystemColumnInsetContext,
} from './backdrop';

const isIOS = Platform.OS === 'ios';

/**
 * Survive Fast Refresh remounts: when this module re-evaluates while the
 * window still holds the width we previously wrote, `Dimensions.get('window')`
 * can no longer tell us the real (native) width. Keeping the last native
 * values at module scope lets a fresh mount recover them.
 */
let lastNativeWindow: ScaledSize | null = null;
let lastAppliedWidth: number | null = null;

/**
 * Full-bleed frame for the iPhone Duo outer screen.
 *
 * The app tree keeps the full window width so a screen's background layer
 * (gradient, image, colour) runs under the system control column; the content
 * containers and every JS header inset themselves through
 * `SystemColumnInsetContext` instead.
 *
 * Components still size themselves from `Dimensions.get('window').width`, so
 * the frame also publishes the content width (native width minus the column)
 * through `Dimensions.set()` — the same entry point the native
 * `didUpdateDimensions` event uses — and re-applies it whenever native
 * dimensions change. That keeps `Dimensions` / `useWindowDimensions`
 * consumers aligned with the padded content area without touching screens.
 *
 * The component itself is only exported for foldable iOS devices. Every other
 * platform / model exports `React.Fragment`, so those builds keep the previous
 * behaviour with zero extra hooks, effects or `Dimensions` writes.
 */
function SafeWindowFrameImpl({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors2024, isLight } = useTheme2024();

  /**
   * Follow the focused screen's declared background.
   *
   * `ScreenSpecs` (constant/layout) is already the single source of truth for a
   * screen's background - the stack navigator feeds the same helper into
   * `contentStyle` - so the strip can reuse it instead of hard-coding a colour.
   * Only the route name is stored: the colour is resolved per render, which
   * keeps light/dark switches correct without an extra listener.
   */
  const [routeName, setRouteName] = React.useState<string | undefined>();

  React.useEffect(() => {
    const onRouteChange = (ctx: { currentRouteName?: string }) => {
      if (ctx.currentRouteName) {
        setRouteName(ctx.currentRouteName);
      }
    };
    const onNavigationReady = (ctx: { readyRootName?: string }) => {
      if (ctx.readyRootName) {
        setRouteName(ctx.readyRootName);
      }
    };
    perfEvents.addListener('EVENT_ROUTE_CHANGE', onRouteChange);
    perfEvents.addListener('APP_NAVIGATION_READY', onNavigationReady);
    return () => {
      perfEvents.removeListener('EVENT_ROUTE_CHANGE', onRouteChange);
      perfEvents.removeListener('APP_NAVIGATION_READY', onNavigationReady);
    };
  }, []);

  const leftInset = isIOS ? Math.max(0, Math.round(insets.left)) : 0;
  const rightInset = isIOS ? Math.max(0, Math.round(insets.right)) : 0;
  const active = leftInset > 0 || rightInset > 0;

  /**
   * Pages may override the strip colour; the default is the page background so
   * the strip blends in instead of showing a band next to the system column.
   */
  const [backdropColor, setBackdropColor] = React.useState<string | null>(null);

  const declaredBackground = routeName
    ? getScreenContentBackgroundColor({
        screenName: routeName,
        isDarkTheme: !isLight,
      })
    : 'transparent';
  const stripColor =
    backdropColor ??
    (declaredBackground === 'transparent'
      ? colors2024['neutral-bg-0']
      : declaredBackground);

  const lastWrittenWidthRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!active) {
      return;
    }

    const applyWindow = (win: ScaledSize) => {
      const screen = Dimensions.get('screen');
      const isOwnValue =
        lastAppliedWidth !== null &&
        Math.abs(win.width - lastAppliedWidth) < 0.5;
      // Prefer the value we recorded from the platform. Never derive the
      // native width from `screen`: on iPad/Duo split panes the window is
      // narrower than the screen, and `max(window, screen)` would over-shrink.
      const nativeWidth =
        isOwnValue && lastNativeWindow ? lastNativeWindow.width : win.width;
      const targetWidth = Math.max(0, nativeWidth - leftInset - rightInset);
      const nativeWindow = { ...win, width: nativeWidth };

      lastNativeWindow = nativeWindow;
      lastAppliedWidth = targetWidth;
      lastWrittenWidthRef.current = targetWidth;
      Dimensions.set({
        window: { ...win, width: targetWidth },
        screen,
      });
    };

    applyWindow(Dimensions.get('window'));

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const lastWritten = lastWrittenWidthRef.current;
      if (lastWritten !== null && Math.abs(window.width - lastWritten) < 0.5) {
        // Our own `Dimensions.set` echo; the platform has not changed.
        return;
      }
      applyWindow(window);
    });

    return () => {
      subscription.remove();
      lastWrittenWidthRef.current = null;
      if (lastNativeWindow) {
        Dimensions.set({
          window: lastNativeWindow,
          screen: Dimensions.get('screen'),
        });
      }
    };
  }, [active, leftInset, rightInset]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <SystemColumnInsetContext.Provider
      value={{ left: leftInset, right: rightInset }}>
      <SafeWindowBackdropContext.Provider value={setBackdropColor}>
        {/*
          The app tree keeps the full window width so a screen's background
          layer (gradient, image, colour) runs under the system column. The
          content containers and every header inset themselves through
          `useSystemColumnInset`; on this posture every stack header is a JS
          header, so the native bar geometry is never involved.
        */}
        <View style={[styles.frame, { backgroundColor: stripColor }]}>
          <View style={styles.content}>{children}</View>
        </View>
      </SafeWindowBackdropContext.Provider>
    </SystemColumnInsetContext.Provider>
  );
}

const SafeWindowFrame = isFoldableIosDevice()
  ? SafeWindowFrameImpl
  : (React.Fragment as unknown as typeof SafeWindowFrameImpl);

export default SafeWindowFrame;

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
});
