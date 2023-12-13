import { Button, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { ScreenColors } from '@/constant/layout';
import { keyringService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';
import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AddressInput } from './components/AddressInput';

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
        },
        inputContainer: {
          backgroundColor: colors['neutral-bg-2'],
          height: '100%',
          paddingVertical: 24,
          paddingHorizontal: 20,
        },
      }),

    [colors],
  );
  const state = useNavigationState(
    s => s.routes.find(r => r.name === 'ImportSuccess')?.params,
  ) as {
    address: string;
    brandName: string;
    wcId: string;
  };
  const { validServices } = useValidWalletServices();

  const handlePress = () => {
    console.log('handlePress');
    keyringService.signPersonalMessage(
      {
        from: state.address,
        data: '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
      },
      {
        brandName: state.brandName,
      },
    );
    console.log(state, validServices.length);
    const service = validServices.find(s => s.id === state.wcId);
    if (service) openWallet(service);
  };

  return (
    <RootScreenContainer style={styles.rootContainer}>
      <View style={styles.titleContainer}>
        <Text>Added successfully</Text>
      </View>
      <View style={styles.inputContainer}>
        <Text>{state.address}</Text>
        <Text>{state.brandName}</Text>
        {/* <AddressInput /> */}

        <Text onPress={handlePress}> 签名</Text>
      </View>
    </RootScreenContainer>
  );
};
