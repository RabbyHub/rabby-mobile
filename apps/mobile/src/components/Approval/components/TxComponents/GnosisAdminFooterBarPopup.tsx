import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { ComponentProps } from 'react';
import { FooterBar } from '../FooterBar/FooterBar';
// import { Button } from 'antd';
// import { Account } from 'background/service/preference';
// import { useWallet, isSameAddress } from 'ui/utils';
// import { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
// import { AddressItem, ownerPriority } from './DrawerAddressItem';

interface GnosisDrawerProps extends ComponentProps<typeof FooterBar> {
  visible?: boolean;
}

export const GnosisAdminFooterBarPopup = ({
  visible,
  onCancel,
  ...rest
}: GnosisDrawerProps) => {
  const modalRef = React.useRef<AppBottomSheetModal>(null);

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={() => onCancel?.()}
      enableDynamicSizing>
      <BottomSheetView>
        <FooterBar onCancel={onCancel} {...rest} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};
