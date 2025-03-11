import { useNavigation } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootNames } from '@/constant/layout';
import { useCallback } from 'react';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

const sendScreenParamsAtom = atom<{ [key: string]: any }>({});
const isSingleAddressAtom = atom<boolean>(false);
export const useSendRoutes = () => {
  const navigation = useNavigation<HomeProps['navigation']>();
  const [params, setParams] = useAtom(sendScreenParamsAtom);
  const [isSingleAddress, setIsSingleAddress] = useAtom(isSingleAddressAtom);

  const navigateToSendPolyScreen = useCallback(
    (isForSingleAddress: boolean, p?: { [key: string]: any }) => {
      setParams(p || {});
      setIsSingleAddress(isForSingleAddress);
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.SendTo,
      });
    },
    [navigation, setIsSingleAddress, setParams],
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
