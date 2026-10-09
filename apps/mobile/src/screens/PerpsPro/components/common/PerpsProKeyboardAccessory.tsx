import { PerpsProKeyboardAccessoryBar } from './PerpsProKeyboardAccessoryBar';
import { dismissPerpsProKeyboard } from './dismissPerpsProKeyboard';
import { usesPerpsProInputAccessory } from './perpsProKeyboardAccessoryBinding';
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
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';

import {
  getPerpsProKeyboardAccessoryTop,
  PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
  PERPS_PRO_KEYBOARD_ACCESSORY_ID,
  perpsProKeyboardSession,
  scrollPerpsProTradeAboveKeyboard,
} from './perpsProKeyboardSession';

// Android Paper's measureInWindow subtracts the visible-window top, whereas
// Keyboard.screenY is absolute. Our full-screen Activity's top inset is the
// status bar; apply the same conversion to the overlay and focused input.
const windowYToScreenY = (y: number) =>
  y + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);

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
  const presentation = useSyncExternalStore(
    perpsProKeyboardSession.subscribe,
    perpsProKeyboardSession.getAndroidPresentation,
    perpsProKeyboardSession.getAndroidPresentation,
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
    const show = (event: KeyboardEvent) => {
      setKeyboardY(
        event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null,
      );
      if (Platform.OS === 'android') {
        perpsProKeyboardSession.setAndroidKeyboardVisible(
          event.endCoordinates.height > 0,
        );
      }
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardY(null);
        setHostY(null);
        if (Platform.OS === 'android') {
          perpsProKeyboardSession.setAndroidKeyboardVisible(false);
        }
      }),
    ];
    if (Platform.OS === 'ios') {
      subscriptions.push(Keyboard.addListener('keyboardWillChangeFrame', show));
    }
    // Subscribe before reading the native-event snapshot so a first show
    // cannot be lost between the input focusing and this owner becoming active.
    const metrics = Keyboard.metrics();
    setKeyboardY(metrics && metrics.height > 0 ? metrics.screenY : null);
    if (Platform.OS === 'android') {
      perpsProKeyboardSession.setAndroidKeyboardVisible(
        !!metrics && metrics.height > 0,
      );
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
  if (usesPerpsProInputAccessory()) {
    // Fabric hosts live beside their inputs; this owner still handles lifecycle/scroll.
    return null;
  }
  if (Platform.OS === 'ios') {
    // Paper binds an inputAccessoryView when inputAccessoryViewID changes,
    // not on each focus. Keep this native host for the input's full lifetime.
    return (
      <InputAccessoryView nativeID={PERPS_PRO_KEYBOARD_ACCESSORY_ID}>
        <PerpsProKeyboardAccessoryBar
          minimum={enabled ? focused?.minimum ?? null : null}
          onDone={dismissPerpsProKeyboard}
          width={dimensions.width}
        />
      </InputAccessoryView>
    );
  }
  if (!enabled || !presentation || keyboardY == null) {
    return null;
  }
  return (
    <Portal
      key={presentation.key}
      hostName={hostName}
      name={`perps-pro-keyboard-${presentation.key}`}>
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
          <PerpsProKeyboardAccessoryBar
            minimum={focused?.minimum ?? null}
            onDone={dismissPerpsProKeyboard}
            width={dimensions.width}
          />
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
