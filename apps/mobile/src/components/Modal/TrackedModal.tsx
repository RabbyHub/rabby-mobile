import React from 'react';
import { Modal as RNModal, ModalProps as RNModalProps } from 'react-native';

import { useRegisterBlockingModal } from '@/utils/modalGate';

type TrackedModalProps = RNModalProps & {
  modalId: string;
  blocking?: boolean;
};

export function TrackedModal({
  modalId,
  blocking = true,
  visible = false,
  children,
  ...props
}: React.PropsWithChildren<TrackedModalProps>) {
  useRegisterBlockingModal(modalId, !!visible && !!blocking);

  return (
    <RNModal visible={visible} {...props}>
      {children}
    </RNModal>
  );
}
