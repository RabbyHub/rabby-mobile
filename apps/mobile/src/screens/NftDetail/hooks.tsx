import React from 'react';
// import { atom, useAtom } from "jotai";

// import { useSheetModal } from "@/hooks/useSheetModal";
// import { BottomSheetModalMethods } from "@gorhom/bottom-sheet/src/types";
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { NFTDetailPopupInner } from '@/screens/NftDetail/PopupInner';
import { RootNames } from '@/constant/layout';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { navigate } from '@/utils/navigation';

// const popups = {
//   nftDetailPopupOnHistory: {
//     atom: atom({
//       nft: null as NFTItem/*  | TransferingNFTItem */ | null,
//       isMyOwn: false,
//     }),
//     ref: React.createRef<BottomSheetModalMethods>(),
//   },
// };

export function useNFTDetailSheetModalOnHistory() {
  // const [{
  //   nft: focusingNftToken,
  //   isMyOwn: isFocusingNftMyOwn,
  // }, onFocusNftToken] = useAtom(
  //   popups.nftDetailPopupOnHistory.atom,
  // );
  // const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
  //   popups.nftDetailPopupOnHistory.ref,
  // );

  // const openNftDetailPopup = useCallback(
  //   (token: NFTItem, opts?: { isMyOwn?: boolean }) => {
  //     onFocusNftToken({ nft: token, isMyOwn: opts?.isMyOwn || false });
  //     toggleShowSheetModal(true);
  //   },
  //   [onFocusNftToken, toggleShowSheetModal],
  // );

  // const cleanFocusingNft = useCallback(
  //   (options?: { noNeedCloseModal?: boolean }) => {
  //     if (!options?.noNeedCloseModal) toggleShowSheetModal(false);

  //     onFocusNftToken({
  //       nft: null,
  //       isMyOwn: false,
  //     });
  //   },
  //   [onFocusNftToken, toggleShowSheetModal],
  // );

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

                  navigate(RootNames.StackTransaction, {
                    screen: RootNames.SendNFT,
                    params: {
                      collectionName,
                      nftItem: nftToken as any,
                    },
                  });
                }}
                token={nftToken as any}
                collectionName={collectionName}
              />
            ),
        },
        token: nftToken as any,
        collectionName,
      });
    },
    [],
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
