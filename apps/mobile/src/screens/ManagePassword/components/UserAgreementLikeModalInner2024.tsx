import React from 'react';

import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

export function useShowUserAgreementLikeModal() {
  const openedModalIdRef = React.useRef<string>('');
  const viewTermsOfUse = React.useCallback(() => {
    openedModalIdRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.TIP_TERM_OF_USE,
      title: '',
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          removeGlobalBottomSheetModal2024(openedModalIdRef.current);
          openedModalIdRef.current = '';
        },
      },
    });
  }, []);

  const openedModal2IdRef = React.useRef<string>('');
  const viewPrivacyPolicy = React.useCallback(() => {
    openedModal2IdRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
      title: '',
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          removeGlobalBottomSheetModal2024(openedModal2IdRef.current);
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
