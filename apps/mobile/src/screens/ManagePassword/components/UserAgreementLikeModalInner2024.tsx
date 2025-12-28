import React from 'react';

import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_NAMES,
  MODAL_ID,
} from '@/components2024/GlobalBottomSheetModal/types';

export function useShowUserAgreementLikeModal() {
  const openedModalIdRef = React.useRef<MODAL_ID | string>('');
  const viewTermsOfUse = React.useCallback(() => {
    openedModalIdRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.TIP_TERM_OF_USE,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          removeGlobalBottomSheetModal2024(
            openedModalIdRef.current as MODAL_ID,
          );
          openedModalIdRef.current = '';
        },
      },
    });
  }, []);

  const openedModal2IdRef = React.useRef<MODAL_ID | string>('');
  const viewPrivacyPolicy = React.useCallback(() => {
    openedModal2IdRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          removeGlobalBottomSheetModal2024(
            openedModal2IdRef.current as MODAL_ID,
          );
          openedModal2IdRef.current = '';
        },
      },
    });
  }, []);

  return {
    viewPrivacyPolicy,
    viewTermsOfUse,
  };
}
