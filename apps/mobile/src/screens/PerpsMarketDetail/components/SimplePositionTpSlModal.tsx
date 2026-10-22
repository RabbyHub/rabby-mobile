import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, StyleSheet } from 'react-native';
import { useBottomSheetModalInternal } from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import {
  useRegisterBlockingModal,
  type ModalGateId,
} from '@/utils/modalGate';

type Props = React.PropsWithChildren<{
  modalId: ModalGateId;
  visible?: boolean;
  onRequestClose?: () => void;
}>;

/** Shares the authentication sheet's host without creating a native Modal. */
export function SimplePositionTpSlModal({
  modalId,
  visible = false,
  onRequestClose,
  children,
}: Props) {
  const { hostName } = useBottomSheetModalInternal();
  const id = useId();
  const portalName = `simple-position-tpsl-${id}`;
  const [present, setPresent] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(0));
  const closeRequest = useRef({ visible, onRequestClose });
  closeRequest.current = { visible, onRequestClose };

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
      if (active && finished && !visible) {
        setPresent(false);
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
        {children}
      </Animated.View>
    </Portal>
  );
}
