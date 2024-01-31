import { FocusAwareStatusBar, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { contactService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { AddressInput } from './components/AddressInput';
import ImportSuccessSVG from '@/assets/icons/address/import-success.svg';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { navigate } from '@/utils/navigation';
import { useAccounts } from '@/hooks/account';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeSizes } from '@/hooks/useAppLayout';

export const ImportSuccessScreen = () => {
  const colors = useThemeColors();
  const { fetchAccounts } = useAccounts();
  const { safeOffHeader } = useSafeSizes();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        rootContainer: {
          display: 'flex',
          backgroundColor: colors['blue-default'],
        },
        titleContainer: {
          width: '100%',
          height: 320 - safeOffHeader,
          flexShrink: 0,
          backgroundColor: colors['blue-default'],
          color: colors['neutral-title-2'],
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: colors['neutral-title-2'],
          marginTop: 25,
        },
        inputContainer: {
          backgroundColor: colors['neutral-bg-2'],
          paddingVertical: 24,
          paddingHorizontal: 20,
        },
        keyboardView: {
          flex: 1,
          height: '100%',
          backgroundColor: colors['neutral-bg-2'],
        },
      }),

    [colors, safeOffHeader],
  );
  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportSuccess)?.params,
  ) as {
    address: string;
    brandName: string;
    deepLink: string;
  };
  const [aliasName, setAliasName] = React.useState<string>('');

  const handleDone = () => {
    contactService.setAlias({
      address: state.address,
      alias: aliasName || '',
    });
    Keyboard.dismiss();
    navigate(RootNames.StackRoot, {
      screen: RootNames.Home,
    });
  };

  React.useEffect(() => {
    setAliasName(contactService.getAliasByAddress(state.address)?.alias || '');
  }, [state]);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <RootScreenContainer hideBottomBar style={styles.rootContainer}>
      <KeyboardAwareScrollView
        style={styles.keyboardView}
        enableOnAndroid
        extraHeight={150}
        scrollEnabled={false}
        keyboardOpeningTime={0}>
        <View style={styles.titleContainer}>
          <ImportSuccessSVG />
          <Text style={styles.title}>Added successfully</Text>
        </View>
        <View style={styles.inputContainer}>
          <AddressInput
            aliasName={aliasName}
            address={state.address}
            onChange={setAliasName}
          />
        </View>
      </KeyboardAwareScrollView>
      <FooterButton title="Done" onPress={handleDone} />
      <FocusAwareStatusBar backgroundColor={colors['blue-default']} />
    </RootScreenContainer>
  );
};
