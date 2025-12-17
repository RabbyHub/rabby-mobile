import React from 'react';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { NFTDetailPopupInner } from '@/screens/NftDetail/PopupInner';
import { RootNames } from '@/constant/layout';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { navigateDeprecated } from '@/utils/navigation';
import { Account } from '@/core/services/preference';

/**
 * @deprecated
 */
export function useNFTDetailSheetModalOnHistory({
  account,
}: {
  account: Account;
}) {
  const idRef = React.useRef<string | null>(null);
  const handlePressNftToken = React.useCallback(
    (nftToken: NFTItem, opts?: { needSendButton?: boolean }) => {
      if (idRef.current) return;

      const { needSendButton = true } = opts || {};
      const collectionName = nftToken?.collection?.name || '';

      const clear = () => {
        removeGlobalBottomSheetModal(idRef.current);
        idRef.current = null;
      };

      idRef.current = createGlobalBottomSheetModal({
        name: MODAL_NAMES.NFT_DETAIL,
        bottomSheetModalProps: {
          onDismiss: clear,
          footerComponent: () =>
            !needSendButton ? null : (
              <NFTDetailPopupInner.FooterComponent
                onPressSend={() => {
                  clear();

                  navigateDeprecated(RootNames.StackTransaction, {
                    screen: RootNames.SendNFT,
                    params: {
                      collectionName,
                      nftItem: nftToken,
                      fromAccount: account,
                    },
                  });
                }}
                token={nftToken}
                collectionName={collectionName}
              />
            ),
        },
        token: nftToken,
        collectionName,
      });
    },
    [account],
  );

  return {
    // sheetModalRef,
    // focusingNftToken,
    // isFocusingNftMyOwn,

    // openNftDetailPopup,
    // cleanFocusingNft,
    handlePressNftToken,
  };
}
