import React from 'react';
/* eslint-disable no-restricted-imports -- TrackedModal is the wrapper around React Native Modal. */
import {
  Modal as RNModal,
  ModalProps as RNModalProps,
  Platform,
} from 'react-native';

import { acquireBlockingModal, type ModalGateId } from '@/utils/modalGate';

type TrackedModalProps = RNModalProps & {
  modalId: ModalGateId;
  blocking?: boolean;
};

export function useTrackedModalGate({
  blocking = true,
  modalId,
  visible = false,
}: {
  blocking?: boolean;
  modalId: ModalGateId;
  visible?: boolean;
}) {
  const isIOS = Platform.OS === 'ios';
  const releaseRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!visible) {
      // iOS keeps the modal host mounted through the dismiss animation. Keep
      // the gate until onDismiss so a second modal cannot present on top of it.
      if (!isIOS) {
        releaseRef.current?.();
        releaseRef.current = null;
      }
      return;
    }

    if (!blocking) {
      releaseRef.current?.();
      releaseRef.current = null;
      return;
    }

    if (!releaseRef.current) {
      releaseRef.current = acquireBlockingModal(modalId);
    }

    if (!isIOS) {
      return () => {
        releaseRef.current?.();
        releaseRef.current = null;
      };
    }
  }, [blocking, isIOS, modalId, visible]);

  React.useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  const release = React.useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  return { release };
}

export function TrackedModal({
  modalId,
  blocking = true,
  visible = false,
  children,
  onDismiss,
  ...props
}: React.PropsWithChildren<TrackedModalProps>) {
  const { release } = useTrackedModalGate({ blocking, modalId, visible });
  const handleDismiss = React.useCallback(() => {
    release();
    onDismiss?.();
  }, [onDismiss, release]);

  return (
    <RNModal visible={visible} {...props} onDismiss={handleDismiss}>
      {children}
    </RNModal>
  );
}
