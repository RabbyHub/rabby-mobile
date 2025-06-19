import { useNavigation } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootNames } from '@/constant/layout';
import { useCallback } from 'react';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { matomoRequestEvent } from '@/utils/analytics';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

export const sendScreenParamsAtom = atom<{ [key: string]: any }>({});
export const isSingleAddressAtom = atom<boolean>(false);
export const useSendRoutes = () => {
  const navigation = useNavigation<HomeProps['navigation']>();
  const { findAccountWithoutBalance } = useWhiteListAddress(true);
  const [params, setParams] = useAtom(sendScreenParamsAtom);
  const [isSingleAddress, setIsSingleAddress] = useAtom(isSingleAddressAtom);

  // check if has nft params
  const hasNftParams = useCallback((mergedParams: { [key: string]: any }) => {
    return !!mergedParams.nftItem;
  }, []);

  // get target screen by params and mode
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

  // navigate to send screen
  const navigateToTargetScreen = useCallback(
    (mergedParams: { [key: string]: any }, isForSingleAddress: boolean) => {
      const targetScreen = getTargetScreen(mergedParams, isForSingleAddress);

      navigation.push(RootNames.StackTransaction, {
        screen: targetScreen as any,
        params: mergedParams,
      });
    },
    [navigation, getTargetScreen],
  );

  const navigateToSendScreen = useCallback(
    (p?: { [key: string]: any }) => {
      const mergedParams = { ...params, ...p };
      navigateToTargetScreen(mergedParams, isSingleAddress);
    },
    [params, isSingleAddress, navigateToTargetScreen],
  );

  const navigateToSendPolyScreen = useCallback(
    async (isForSingleAddress: boolean, p?: { [key: string]: any }) => {
      matomoRequestEvent({
        category: 'Send Usage',
        action: 'Send_Enter',
      });
      setParams(p || {});
      setIsSingleAddress(!!isForSingleAddress);
      if (p?.toAddress) {
        const { inWhitelist, account, isMyImported } =
          findAccountWithoutBalance(p.toAddress, undefined);
        if (inWhitelist || isMyImported) {
          const mergedParams = { ...params, ...p };
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
            onConfirm(acc, addressDesc) {
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
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.SendTo,
      });
    },
    [
      findAccountWithoutBalance,
      navigateToSendScreen,
      navigation,
      params,
      setIsSingleAddress,
      setParams,
      navigateToTargetScreen,
    ],
  );

  return {
    navigateToSendPolyScreen,
    navigateToSendScreen,
    isSingleAddress,
  };
};
