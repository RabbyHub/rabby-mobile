import React from 'react';
import {
  Dimensions,
  type ScaledSize,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme2024 } from '@/hooks/theme';

const isIOS = Platform.OS === 'ios';

/**
 * Device ids that expose a horizontal system column on iOS. Add new foldable
 * ids here once they are supported; everything else gets `React.Fragment`, so
 * unsupported devices never mount the frame or touch `Dimensions`.
 */
const FOLDABLE_IOS_DEVICE_IDS = ['iPhone19,4'];

function isFoldableIosDevice() {
  if (!isIOS) {
    return false;
  }

  try {
    if (FOLDABLE_IOS_DEVICE_IDS.includes(DeviceInfo.getDeviceId())) {
      return true;
    }
    return /duo/i.test(DeviceInfo.getModel() || '');
  } catch {
    return false;
  }
}

/**
 * Survive Fast Refresh remounts: when this module re-evaluates while the
 * window still holds the width we previously wrote, `Dimensions.get('window')`
 * can no longer tell us the real (native) width. Keeping the last native
 * values at module scope lets a fresh mount recover them.
 */
let lastNativeWindow: ScaledSize | null = null;
let lastAppliedWidth: number | null = null;

/**
 * Keeps the whole app inside the horizontally safe part of the window.
 *
 * On iPhone Duo (iOS foldable) the system draws its own control column on the
 * right edge of some windows (cover screen / inner right pane). Every existing
 * screen only consumes `insets.top` / `insets.bottom`, so the right column ends
 * up covering app content. Insetting the root once is the documented
 * short-term workaround ("display area limited to the left of the navigation
 * bar") and is a no-op on phones where `left`/`right` are 0.
 *
 * Padding alone is not enough: plenty of components size themselves from
 * `Dimensions.get('window').width`, so they would still be laid out for the
 * full window and get clipped at the safe-area edge. React Native has no
 * safe-area-aware window size (upstream `Dimensions` still reports the key
 * window bounds), so we publish the reduced width through `Dimensions.set()`
 * — the same entry point the native `didUpdateDimensions` event uses — and
 * re-apply it whenever native dimensions change. This keeps every consumer of
 * `Dimensions` / `useWindowDimensions` consistent without touching screens.
 *
 * The component itself is only exported for foldable iOS devices. Every other
 * platform / model exports `React.Fragment`, so those builds keep the previous
 * behaviour with zero extra hooks, effects or `Dimensions` writes.
 */
function SafeWindowFrameImpl({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors2024 } = useTheme2024();

  const leftInset = isIOS ? Math.max(0, Math.round(insets.left)) : 0;
  const rightInset = isIOS ? Math.max(0, Math.round(insets.right)) : 0;
  const active = leftInset > 0 || rightInset > 0;

  const [availableWidth, setAvailableWidth] = React.useState<number | null>(
    null,
  );
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
      setAvailableWidth(targetWidth);
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
    <View
      style={[styles.frame, { backgroundColor: colors2024['neutral-bg-1'] }]}>
      {leftInset > 0 ? <View style={{ width: leftInset }} /> : null}
      <View style={[styles.content, { width: availableWidth ?? undefined }]}>
        {children}
      </View>
      {rightInset > 0 ? <View style={{ width: rightInset }} /> : null}
    </View>
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
