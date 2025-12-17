import { useNavigation } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useCallback } from 'react';
import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { matomoRequestEvent } from '@/utils/analytics';
import { naviPush } from '@/utils/navigation';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;
export const sendScreenParamsAtom = atom<{ [key: string]: any }>({});
export const isSingleAddressAtom = atom<boolean>(false);
export const useSendRoutes = () => {
  const { findAccountWithoutBalance } = useFindAddressByWhitelist();
  const [params, setParams] = useAtom(sendScreenParamsAtom);
  const [isSingleAddress, setIsSingleAddress] = useAtom(isSingleAddressAtom);

  const hasNftParams = useCallback((mergedParams: { [key: string]: any }) => {
    return !!mergedParams.nftItem;
  }, []);

  const getTargetScreen = useCallback(
    (mergedParams: { [key: string]: any }, isForSingleAddress: boolean) => {
      const hasNft = hasNftParams(mergedParams);
      if (hasNft) {
        return RootNames.SendNFT;
      } else {
        return isForSingleAddress ? RootNames.Send : RootNames.MultiSend;
      }
    },
    [hasNftParams],
  );

  /** @deprecated */
  const navigateToTargetScreen = useCallback(
    (mergedParams: { [key: string]: any }, isForSingleAddress: boolean) => {
      const targetScreen = getTargetScreen(mergedParams, isForSingleAddress);

      naviPush(RootNames.StackTransaction, {
        screen: targetScreen,
        params: mergedParams,
      } as NavigatorScreenParams<TransactionNavigatorParamList>);
    },
    [getTargetScreen],
  );

  const navigateToSendScreen = useCallback(
    (p?: { [key: string]: any }) => {
      const mergedParams = { ...params, ...p };
      navigateToTargetScreen(mergedParams, isSingleAddress);
    },
    [params, isSingleAddress, navigateToTargetScreen],
  );

  /** @deprecated */
  const navigateToSendPolyScreen = useCallback(
    async (isForSingleAddress: boolean, p?: { [key: string]: any }) => {
      matomoRequestEvent({
        category: 'Send Usage',
        action: 'Send_Enter',
      });
      setParams(p || {});
      setIsSingleAddress(!!isForSingleAddress);

      const mergedParams = { ...params, ...p };

      if (p?.toAddress) {
        const { inWhitelist, account, isMyImported } =
          findAccountWithoutBalance(p.toAddress);
        if (inWhitelist || isMyImported) {
          navigateToTargetScreen(mergedParams, isForSingleAddress);
        } else {
          const id = createGlobalBottomSheetModal2024({
            name: MODAL_NAMES.CONFIRM_ADDRESS,
            account,
            bottomSheetModalProps: {
              enableDynamicSizing: true,
            },
            onCancel: () => {
              removeGlobalBottomSheetModal2024(id);
            },
            onConfirm: (acc, addressDesc) => {
              removeGlobalBottomSheetModal2024(id);
              navigateToSendScreen({
                ...p,
                addressBrandName: acc.brandName,
                addrDesc: addressDesc,
                toAddress: acc.address,
              });
            },
          });
        }
        return;
      }

      naviPush(
        RootNames.StackTransaction,
        !mergedParams.nftItem
          ? {
              screen: RootNames.Send,
            }
          : {
              screen: RootNames.SendNFT,
              params: {
                nftItem: mergedParams.nftItem,
                collectionName: mergedParams.collectionName,
                fromAccount: mergedParams.fromAccount,
              },
            },
      );
    },
    [
      findAccountWithoutBalance,
      navigateToSendScreen,
      params,
      setIsSingleAddress,
      setParams,
      navigateToTargetScreen,
    ],
  );

  return {
    /** @deprecated */
    navigateToSendPolyScreen,
    navigateToSendScreen,
    isSingleAddress,
  };
};
