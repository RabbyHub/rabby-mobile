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
import {
  FOLDABLE_WIDE_CENTERED_COLUMN_ENABLED,
  FOLDABLE_WIDE_CONTENT_MAX_WIDTH,
  isFoldableIosDevice,
  isFoldableWidePosture,
} from '@/core/utils/foldableDevice';
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

  /** True while this frame is the one publishing `Dimensions.set`. */
  const ownDimensionsWriteRef = React.useRef(false);
  /** Content width of the centered column in the wide inner-screen posture. */
  const [wideWidth, setWideWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    /**
     * Publish a synthetic window size. `Dimensions.set` emits its change event
     * synchronously, so the listener below can recognise our own echo through a
     * flag instead of guessing from the published width.
     */
    const writeDimensions = (next: Parameters<typeof Dimensions.set>[0]) => {
      ownDimensionsWriteRef.current = true;
      try {
        Dimensions.set(next);
      } finally {
        ownDimensionsWriteRef.current = false;
      }
    };

    const applyWindow = (win: ScaledSize) => {
      const screen = Dimensions.get('screen');
      // Every value that reaches here is a native update: our own writes are
      // filtered by `ownDimensionsWriteRef` in the change listener.
      const nativeWidth = win.width;
      const nativeHeight = win.height;
      const nativeWindow = { ...win };
      lastNativeWindow = nativeWindow;

      const inWidePosture =
        !active &&
        FOLDABLE_WIDE_CENTERED_COLUMN_ENABLED &&
        isFoldableWidePosture(nativeWindow);
      const targetWidth = active
        ? Math.max(0, nativeWidth - leftInset - rightInset)
        : inWidePosture
        ? Math.min(nativeWidth, FOLDABLE_WIDE_CONTENT_MAX_WIDTH)
        : null;

      if (targetWidth === null) {
        setWideWidth(null);
        if (lastAppliedWidth !== null) {
          lastAppliedWidth = null;
          writeDimensions({
            window: nativeWindow,
            screen,
          });
        }
        return;
      }

      lastAppliedWidth = targetWidth;
      setWideWidth(active ? null : targetWidth);
      writeDimensions({
        window: { ...win, width: targetWidth, height: nativeHeight },
        screen,
      });
    };

    applyWindow(Dimensions.get('window'));

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      if (ownDimensionsWriteRef.current) {
        // Our own `Dimensions.set` echo; the platform has not changed.
        return;
      }
      applyWindow(window);
    });

    return () => {
      subscription.remove();
      lastAppliedWidth = null;
      if (lastNativeWindow) {
        writeDimensions({
          window: lastNativeWindow,
          screen: Dimensions.get('screen'),
        });
      }
    };
  }, [active, leftInset, rightInset]);

  // Always render the same wrapper tree: switching between a Fragment and the
  // nested Views unmounted the whole app subtree (navigation stack, form state
  // and modal hosts) every time a horizontal inset came or went. Inactive
  // postures publish zero insets and no strip colour instead.
  const isWide = wideWidth !== null;

  return (
    <SystemColumnInsetContext.Provider
      value={{
        left: active ? leftInset : 0,
        right: active ? rightInset : 0,
      }}>
      <SafeWindowBackdropContext.Provider value={setBackdropColor}>
        {/*
          The app tree keeps the full window width so a screen's background
          layer (gradient, image, colour) runs under the system column. The
          content containers and every header inset themselves through
          `useSystemColumnInset`; on this posture every stack header is a JS
          header, so the native bar geometry is never involved.
        */}
        <View
          style={[
            isWide ? styles.wideFrame : styles.frame,
            isWide
              ? { backgroundColor: colors2024['neutral-bg-1'] }
              : active
              ? { backgroundColor: stripColor }
              : null,
          ]}>
          <View
            style={[
              isWide ? styles.wideContent : styles.content,
              isWide ? { width: wideWidth } : null,
            ]}>
            {children}
          </View>
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
  wideFrame: {
    flex: 1,
    alignItems: 'center',
  },
  wideContent: {
    flex: 1,
  },
});
