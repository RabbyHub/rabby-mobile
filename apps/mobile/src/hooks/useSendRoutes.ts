import { useNavigation } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootNames } from '@/constant/layout';
import { useCallback } from 'react';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

export const sendScreenParamsAtom = atom<{ [key: string]: any }>({});
export const isSingleAddressAtom = atom<boolean>(false);
export const useSendRoutes = () => {
  const navigation = useNavigation<HomeProps['navigation']>();
  const { findAccount } = useWhiteListAddress(true);
  const [params, setParams] = useAtom(sendScreenParamsAtom);
  const [isSingleAddress, setIsSingleAddress] = useAtom(isSingleAddressAtom);

  const navigateToSendPolyScreen = useCallback(
    (isForSingleAddress: boolean, p?: { [key: string]: any }) => {
      setParams(p || {});
      setIsSingleAddress(isForSingleAddress);
      if (p?.toAddress) {
        const { inWhitelist, account } = findAccount(p.toAddress);
        if (inWhitelist) {
          navigation.push(RootNames.StackTransaction, {
            screen: isForSingleAddress ? RootNames.Send : RootNames.MultiSend,
            params: { ...params, ...p },
          });
        } else {
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.ConfirmAddress,
            params: {
              account,
            },
          });
        }
        return;
      }
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.SendTo,
      });
    },
    [findAccount, navigation, params, setIsSingleAddress, setParams],
  );
  const navigateToSendScreen = useCallback(
    (p?: { [key: string]: any }) => {
      navigation.push(RootNames.StackTransaction, {
        screen: isSingleAddress ? RootNames.Send : RootNames.MultiSend,
        params: { ...params, ...p },
      });
    },
    [navigation, params, isSingleAddress],
  );
  return {
    navigateToSendPolyScreen,
    navigateToSendScreen,
  };
};
