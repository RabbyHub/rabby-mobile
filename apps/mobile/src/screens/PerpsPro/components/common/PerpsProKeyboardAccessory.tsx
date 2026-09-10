import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useBottomSheetModalInternal } from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import { useIsFocused } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AppState,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, {
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  getPerpsProKeyboardAccessoryTop,
  PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
  PERPS_PRO_KEYBOARD_ACCESSORY_ID,
  perpsProKeyboardSession,
  scrollPerpsProTradeAboveKeyboard,
} from './perpsProKeyboardSession';
import { PERPS_PRO_NUMBER_STYLE } from './perpsProNumberText';

const consumeTouch = () => true;
// Approved Figma 83992:157364 colors, scoped to this accessory.
const DONE_COLOR = '#23C0B0';
const SHADOW_COLOR = '#494B5B';
const TOP_RADIUS = 14;
const SHADOW_OFFSET_Y = -8;
const SHADOW_BLUR = 12;
const SHADOW_OPACITY = 0.06;
const SHADOW_TOP = SHADOW_BLUR - SHADOW_OFFSET_Y;
const SHADOW_CORNER_RADIUS = TOP_RADIUS + SHADOW_BLUR;

// Gaussian falloff for Figma's blur=12 (sigma=6), sampled from the inside
// of the 14pt corner to its outer blur edge. Radial corner gradients join
// linear edge gradients; no Android elevation or bitmap filter is needed.
const shadowStops = [
  [0, 0.990185],
  [4 / 26, 0.95221],
  [8 / 26, 0.841345],
  [12 / 26, 0.630559],
  [14 / 26, 0.5],
  [18 / 26, 0.252493],
  [22 / 26, 0.091211],
  [1, 0.02275],
].map(([offset, opacity]) => (
  <Stop
    key={offset}
    offset={offset}
    stopColor={SHADOW_COLOR}
    stopOpacity={opacity * SHADOW_OPACITY}
  />
));

const AndroidAccessoryShadow = React.memo(({ width }: { width: number }) => (
  <Svg
    pointerEvents="none"
    width={width}
    height={SHADOW_TOP + TOP_RADIUS}
    style={stylesOverlay.androidShadow}
    testID="perps-pro-keyboard-android-shadow">
    <Defs>
      <LinearGradient
        id="pro-keyboard-shadow-top"
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={SHADOW_CORNER_RADIUS}
        x2={0}
        y2={0}>
        {shadowStops}
      </LinearGradient>
      <RadialGradient
        id="pro-keyboard-shadow-corner"
        gradientUnits="userSpaceOnUse"
        cx={TOP_RADIUS}
        cy={SHADOW_CORNER_RADIUS}
        r={SHADOW_CORNER_RADIUS}>
        {shadowStops}
      </RadialGradient>
      <LinearGradient
        id="pro-keyboard-shadow-side"
        gradientUnits="userSpaceOnUse"
        x1={TOP_RADIUS}
        y1={0}
        x2={-SHADOW_BLUR}
        y2={0}>
        {shadowStops}
      </LinearGradient>
    </Defs>
    <Rect
      x={TOP_RADIUS}
      width={Math.max(0, width - TOP_RADIUS * 2)}
      height={SHADOW_TOP + TOP_RADIUS}
      fill="url(#pro-keyboard-shadow-top)"
    />
    {[false, true].map(right => (
      <G
        key={String(right)}
        transform={right ? `translate(${width} 0) scale(-1 1)` : undefined}>
        <Rect
          width={TOP_RADIUS}
          height={SHADOW_CORNER_RADIUS}
          fill="url(#pro-keyboard-shadow-corner)"
        />
        <Rect
          y={SHADOW_CORNER_RADIUS}
          width={TOP_RADIUS}
          height={-SHADOW_OFFSET_Y}
          fill="url(#pro-keyboard-shadow-side)"
        />
      </G>
    ))}
  </Svg>
));

// Android Paper's measureInWindow subtracts the visible-window top, whereas
// Keyboard.screenY is absolute. Our full-screen Activity's top inset is the
// status bar; apply the same conversion to the overlay and focused input.
const windowYToScreenY = (y: number) =>
  y + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);

const AccessoryBar = ({
  minimum,
  onDone,
  width,
}: {
  minimum: string | null;
  onDone: () => void;
  width: number;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.shadow} testID="perps-pro-keyboard-shadow">
      {Platform.OS === 'android' ? (
        <AndroidAccessoryShadow width={width} />
      ) : null}
      <View
        onStartShouldSetResponder={consumeTouch}
        style={styles.bar}
        testID="perps-pro-keyboard-accessory">
        {minimum ? (
          <Text
            numberOfLines={1}
            style={styles.minimum}
            testID="perps-pro-keyboard-minimum">
            {t('page.perps.pro.trade.keyboardMinimum', { amount: minimum })}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('global.Done')}
          onPress={onDone}
          style={styles.done}
          testID="perps-pro-keyboard-done">
          <Text style={styles.doneText}>{t('global.Done')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

/** Kept outside the realtime Scene: only this leaf observes keyboard/focus UI. */
export const PerpsProKeyboardAccessory = () => {
  // The app's BottomSheetModalProvider owns a dynamically named PortalHost.
  // An unnamed Portal targets "root", which that provider never renders.
  const { hostName } = useBottomSheetModalInternal();
  const focused = useSyncExternalStore(
    perpsProKeyboardSession.subscribe,
    perpsProKeyboardSession.getSnapshot,
    perpsProKeyboardSession.getSnapshot,
  );
  const input = focused?.input;
  const inputId = focused?.id;
  const scrollTrade = focused?.scrollTrade;
  const routeFocused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const [keyboardY, setKeyboardY] = useState<number | null>(null);
  const [hostY, setHostY] = useState<number | null>(null);
  const overlayRef = useRef<View>(null);
  const dimensions = useWindowDimensions();
  const enabled = routeFocused && foreground;
  useLayoutEffect(() => {
    perpsProKeyboardSession.setEnabled(enabled);
  }, [enabled]);
  useLayoutEffect(() => () => perpsProKeyboardSession.setEnabled(false), []);
  useLayoutEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    setForeground(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);
  useLayoutEffect(() => {
    if (!enabled) {
      setKeyboardY(null);
      setHostY(null);
      return;
    }
    const show = (event: KeyboardEvent) =>
      setKeyboardY(
        event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null,
      );
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardY(null);
        setHostY(null);
      }),
    ];
    if (Platform.OS === 'ios') {
      subscriptions.push(Keyboard.addListener('keyboardWillChangeFrame', show));
    }
    // Subscribe before reading the native-event snapshot so a first show
    // cannot be lost between the input focusing and this owner becoming active.
    const metrics = Keyboard.metrics();
    setKeyboardY(metrics && metrics.height > 0 ? metrics.screenY : null);
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [enabled]);
  const measureHost = useCallback(() => {
    const host = overlayRef.current;
    host?.measureInWindow((_x, y) => {
      if (overlayRef.current === host) {
        setHostY(windowYToScreenY(y));
      }
    });
  }, []);
  useEffect(() => {
    if (keyboardY == null || !input) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      measureHost();
      if (!scrollTrade) {
        return;
      }
      input.measureInWindow((_x, y, _width, height) => {
        if (
          perpsProKeyboardSession.getSnapshot()?.id !== inputId ||
          !input.isFocused()
        ) {
          return;
        }
        // iOS includes the native accessory in its keyboard frame already.
        const top =
          keyboardY -
          (Platform.OS === 'android' ? PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT : 0);
        scrollPerpsProTradeAboveKeyboard(
          windowYToScreenY(y) + height + 8 - top,
        );
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    input,
    inputId,
    scrollTrade,
    keyboardY,
    dimensions.height,
    dimensions.width,
    measureHost,
  ]);
  const done = useCallback(() => {
    const current = perpsProKeyboardSession.getSnapshot();
    if (current) {
      current.input.blur();
      perpsProKeyboardSession.blur(current.id);
    }
    Keyboard.dismiss();
  }, []);
  if (Platform.OS === 'ios') {
    // Paper binds an inputAccessoryView when inputAccessoryViewID changes,
    // not on each focus. Keep this native host for the input's full lifetime.
    return (
      <InputAccessoryView nativeID={PERPS_PRO_KEYBOARD_ACCESSORY_ID}>
        <AccessoryBar
          minimum={enabled ? focused?.minimum ?? null : null}
          onDone={done}
          width={dimensions.width}
        />
      </InputAccessoryView>
    );
  }
  if (!enabled || !focused || keyboardY == null) {
    return null;
  }
  return (
    <Portal
      key={focused.id}
      hostName={hostName}
      name={`perps-pro-keyboard-${focused.id}`}>
      <View
        collapsable={false}
        pointerEvents="box-none"
        onLayout={measureHost}
        ref={overlayRef}
        testID="perps-pro-keyboard-overlay"
        style={StyleSheet.absoluteFill}>
        <View
          testID="perps-pro-keyboard-position"
          pointerEvents={hostY == null ? 'none' : 'box-none'}
          style={[
            stylesOverlay.position,
            hostY == null ? stylesOverlay.hidden : null,
            {
              top: getPerpsProKeyboardAccessoryTop(keyboardY, hostY ?? 0),
            },
          ]}>
          <AccessoryBar
            minimum={focused.minimum}
            onDone={done}
            width={dimensions.width}
          />
        </View>
      </View>
    </Portal>
  );
};

const stylesOverlay = StyleSheet.create({
  androidShadow: { position: 'absolute', top: -SHADOW_TOP, left: 0 },
  hidden: { opacity: 0 },
  position: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  shadow: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: TOP_RADIUS,
    borderTopRightRadius: TOP_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'visible',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: SHADOW_COLOR,
          shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
          shadowRadius: SHADOW_BLUR / 2,
          shadowOpacity: SHADOW_OPACITY,
        }
      : {}),
  },
  bar: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
    borderTopLeftRadius: TOP_RADIUS,
    borderTopRightRadius: TOP_RADIUS,
    overflow: 'hidden',
  },
  minimum: {
    ...PERPS_PRO_NUMBER_STYLE,
    position: 'absolute',
    left: 16,
    right: 80,
    top: 15,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  done: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 20,
    paddingTop: 14,
  },
  doneText: {
    color: DONE_COLOR,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));
