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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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

// Android Paper's measureInWindow subtracts the visible-window top, whereas
// Keyboard.screenY is absolute. Our full-screen Activity's top inset is the
// status bar; apply the same conversion to the overlay and focused input.
const windowYToScreenY = (y: number) =>
  y + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);

const AccessoryBar = ({
  minimum,
  onDone,
}: {
  minimum: string | null;
  onDone: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.shadow}>
      {Platform.OS === 'android' ? (
        <Svg
          pointerEvents="none"
          width="100%"
          height={20}
          style={styles.androidShadow}>
          <Defs>
            <LinearGradient
              id="pro-keyboard-shadow"
              x1="0"
              y1="0"
              x2="0"
              y2="1">
              <Stop offset="0" stopColor={SHADOW_COLOR} stopOpacity={0} />
              <Stop offset="0.4" stopColor={SHADOW_COLOR} stopOpacity={0.012} />
              <Stop offset="0.7" stopColor={SHADOW_COLOR} stopOpacity={0.038} />
              <Stop offset="1" stopColor={SHADOW_COLOR} stopOpacity={0.06} />
            </LinearGradient>
          </Defs>
          <Rect
            width="100%"
            height={34}
            rx={14}
            fill="url(#pro-keyboard-shadow)"
          />
        </Svg>
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
    return () => perpsProKeyboardSession.setEnabled(false);
  }, [enabled]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!enabled) {
      setKeyboardY(null);
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
    if (!current) {
      return;
    }
    current.input.blur();
    perpsProKeyboardSession.blur(current.id);
    Keyboard.dismiss();
  }, []);
  if (!enabled) {
    return null;
  }
  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={PERPS_PRO_KEYBOARD_ACCESSORY_ID}>
        <AccessoryBar minimum={focused?.minimum ?? null} onDone={done} />
      </InputAccessoryView>
    );
  }
  if (!focused || keyboardY == null) {
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
          <AccessoryBar minimum={focused.minimum} onDone={done} />
        </View>
      </View>
    </Portal>
  );
};

const stylesOverlay = StyleSheet.create({
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
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: SHADOW_COLOR,
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 6,
          shadowOpacity: 0.06,
        }
      : {}),
  },
  androidShadow: { position: 'absolute', top: -20, left: 0, right: 0 },
  bar: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
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
