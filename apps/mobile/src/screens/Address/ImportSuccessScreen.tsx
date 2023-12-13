import { Button, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { ScreenColors, ScreenLayouts } from '@/constant/layout';
import { contactService, keyringService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AddressInput } from './components/AddressInput';
import ImportSuccessSVG from '@/assets/icons/address/import-success.svg';
import HomeHeaderArea from '../Home/HeaderArea';

export const ImportSuccessScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        rootContainer: {
          display: 'flex',
          backgroundColor: ScreenColors.homeHeaderBlue,
        },
        titleContainer: {
          width: '100%',
          height: 320,
          flexShrink: 0,
          backgroundColor: ScreenColors.homeHeaderBlue,
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: 'white',
          marginTop: 25,
        },
        inputContainer: {
          backgroundColor: colors['neutral-bg-2'],
          height: '100%',
          paddingVertical: 24,
          paddingHorizontal: 20,
        },
        logo: {
          width: 240,
          height: 240,
        },
      }),

    [colors],
  );
  const state = useNavigationState(
    s => s.routes.find(r => r.name === 'ImportSuccess')?.params,
  ) as {
    address: string;
    brandName: string;
    deepLink: string;
  };
  const [aliasName, setAliasName] = React.useState<string>();
  const { validServices } = useValidWalletServices();
  const navigation = useNavigation();

  const handlePress = () => {
    keyringService.signPersonalMessage(
      {
        from: state.address,
        data: '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
      },
      {
        brandName: state.brandName,
      },
    );
    const service = validServices.find(
      s => s.walletInfo.brand === state.brandName,
    );
    if (service) {
      openWallet(service, state.deepLink);
    }
  };

  React.useEffect(() => {
    setAliasName(contactService.getAliasByAddress(state.address)?.alias);
  }, [state]);

  return (
    <RootScreenContainer style={styles.rootContainer}>
      <View style={styles.titleContainer}>
        <ImportSuccessSVG style={styles.logo} />
        <Text style={styles.title}>Added successfully</Text>
      </View>
      <View style={styles.inputContainer}>
        <Text>{state.address}</Text>
        <Text>{state.brandName}</Text>
        <AddressInput aliasName={aliasName} address={state.address} />

        <Text onPress={handlePress}> 签名</Text>
      </View>
    </RootScreenContainer>
  );
};
