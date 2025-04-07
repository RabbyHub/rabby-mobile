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
  const { findAccount } = useWhiteListAddress(true);
  const [params, setParams] = useAtom(sendScreenParamsAtom);
  const [isSingleAddress, setIsSingleAddress] = useAtom(isSingleAddressAtom);
  const navigateToSendScreen = useCallback(
    (p?: { [key: string]: any }) => {
      navigation.push(RootNames.StackTransaction, {
        screen: isSingleAddress ? RootNames.Send : RootNames.MultiSend,
        params: { ...params, ...p },
      });
    },
    [navigation, params, isSingleAddress],
  );
  const navigateToSendPolyScreen = useCallback(
    async (isForSingleAddress: boolean, p?: { [key: string]: any }) => {
      matomoRequestEvent({
        category: 'Send Usage',
        action: 'Send_Enter',
      });
      setParams(p || {});
      setIsSingleAddress(isForSingleAddress);
      if (p?.toAddress) {
        const { inWhitelist, account } = await findAccount(
          p.toAddress,
          undefined,
          true,
        );
        if (inWhitelist) {
          navigation.push(RootNames.StackTransaction, {
            screen: isForSingleAddress ? RootNames.Send : RootNames.MultiSend,
            params: { ...params, ...p },
          });
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
      findAccount,
      navigateToSendScreen,
      navigation,
      params,
      setIsSingleAddress,
      setParams,
    ],
  );

  return {
    navigateToSendPolyScreen,
    navigateToSendScreen,
  };
};
