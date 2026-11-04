import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSheetModalInternal } from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import { useRegisterBlockingModal, type ModalGateId } from '@/utils/modalGate';

type Props = React.PropsWithChildren<{
  modalId: ModalGateId;
  visible?: boolean;
  onRequestClose?: () => void;
  onShow?: () => void;
  onDismiss?: () => void;
  onCloseStart?: () => void;
}>;

/** Mounted only while the editor is present; keyboard updates stay local. */
function PositionViewport({
  visible,
  onCloseStart,
  children,
}: React.PropsWithChildren<{
  visible: boolean;
  onCloseStart?: () => void;
}>) {
  const dimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const hostRef = useRef<View>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const closeStartRef = useRef(onCloseStart);
  closeStartRef.current = onCloseStart;
  const [host, setHost] = useState({ y: 0, height: dimensions.height });
  const [cardHeight, setCardHeight] = useState(0);
  const [keyboardY, setKeyboardY] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      // The Portal has received visible=false before blur emits keyboard events.
      closeStartRef.current?.();
      return;
    }
    if (Platform.OS !== 'ios') return;
    let currentY: number | null = null;
    const move = (nextY: number | null, event: KeyboardEvent) => {
      if (!visibleRef.current || nextY === currentY) return;
      currentY = nextY;
      if (event.duration) Keyboard.scheduleLayoutAnimation(event);
      setKeyboardY(nextY);
    };
    const update = (event: KeyboardEvent) => {
      // Keep the exiting card in place while its input resigns focus.
      move(
        event.endCoordinates.height > 0 && event.endCoordinates.screenY > 0
          ? event.endCoordinates.screenY
          : null,
        event,
      );
    };
    const hide = (event: KeyboardEvent) => {
      move(null, event);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', update),
      Keyboard.addListener('keyboardWillChangeFrame', update),
      Keyboard.addListener('keyboardDidChangeFrame', update),
      Keyboard.addListener('keyboardDidShow', update),
      Keyboard.addListener('keyboardWillHide', hide),
      Keyboard.addListener('keyboardDidHide', hide),
    ];
    const metrics = Keyboard.metrics();
    currentY = metrics && metrics.screenY > 0 ? metrics.screenY : null;
    setKeyboardY(currentY);
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [visible]);

  // Keyboard coordinates are window-relative; convert them to this Portal's
  // measured host before limiting the card. Move only as far as necessary.
  const top = Math.max(0, insets.top - host.y) + 16;
  const restingBottom =
    Math.min(host.height, dimensions.height - insets.bottom - host.y) - 16;
  const bottom =
    keyboardY == null
      ? restingBottom
      : Math.min(restingBottom, keyboardY - host.y - 16);
  const maxHeight = Math.max(0, bottom - top);
  const height = Math.min(cardHeight, maxHeight);

  return (
    <View
      ref={hostRef}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={() => {
        if (Platform.OS !== 'ios') return;
        const node = hostRef.current;
        node?.measureInWindow((_x, y, _width, measuredHeight) => {
          if (
            hostRef.current !== node ||
            !visibleRef.current ||
            measuredHeight <= 0
          )
            return;
          setHost(previous =>
            previous.y === y && previous.height === measuredHeight
              ? previous
              : { y, height: measuredHeight },
          );
        });
      }}>
      <View
        testID="simple-position-tpsl-viewport"
        pointerEvents={visible ? 'box-none' : 'none'}
        onLayout={event => {
          if (Platform.OS === 'ios' && visibleRef.current) {
            setCardHeight(event.nativeEvent.layout.height);
          }
        }}
        style={
          Platform.OS === 'ios'
            ? [
                styles.iosCard,
                {
                  maxHeight,
                  top: Math.max(
                    top,
                    Math.min(
                      (top + restingBottom - height) / 2,
                      bottom - height,
                    ),
                  ),
                },
              ]
            : styles.androidContent
        }>
        {children}
      </View>
    </View>
  );
}

/** Shares the authentication sheet's host without creating a native Modal. */
export function SimplePositionTpSlModal({
  modalId,
  visible = false,
  onRequestClose,
  onShow,
  onDismiss,
  onCloseStart,
  children,
}: Props) {
  const { hostName } = useBottomSheetModalInternal();
  const id = useId();
  const portalName = `simple-position-tpsl-${id}`;
  const [present, setPresent] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(0));
  const closeRequest = useRef({ visible, onRequestClose, onShow, onDismiss });
  closeRequest.current = { visible, onRequestClose, onShow, onDismiss };

  useEffect(() => {
    if (visible) {
      setPresent(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!present) {
      return;
    }
    let active = true;
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!active || !finished || closeRequest.current.visible !== visible)
        return;
      if (visible) closeRequest.current.onShow?.();
      else {
        setPresent(false);
        closeRequest.current.onDismiss?.();
      }
    });
    return () => {
      active = false;
      animation.stop();
    };
  }, [opacity, present, visible]);

  useRegisterBlockingModal(modalId, present);

  useEffect(() => {
    if (!present || Platform.OS !== 'android') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (closeRequest.current.visible) {
          closeRequest.current.onRequestClose?.();
        }
        return true;
      },
    );
    return () => subscription.remove();
    // Keep registration order stable: a later authentication sheet owns Back
    // until it dismisses, even while the editor's quote or callback updates.
  }, [present]);

  if (!present) {
    return null;
  }

  return (
    <Portal hostName={hostName} name={portalName}>
      <Animated.View
        key={portalName}
        style={[StyleSheet.absoluteFill, { opacity }]}>
        <Pressable
          testID="simple-position-tpsl-backdrop"
          style={styles.backdrop}
          onPress={() => {
            if (closeRequest.current.visible) {
              closeRequest.current.onRequestClose?.();
            }
          }}
        />
        <PositionViewport visible={visible} onCloseStart={onCloseStart}>
          {children}
        </PositionViewport>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  iosCard: { position: 'absolute', left: 16, right: 16 },
  androidContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
