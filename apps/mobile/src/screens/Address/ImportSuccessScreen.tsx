import { FocusAwareStatusBar, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { contactService, preferenceService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { useIsFocused, useNavigationState } from '@react-navigation/native';
import React, { useRef } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { AddressInput } from './components/AddressInput';
import ImportSuccessSVG from '@/assets/icons/address/import-success.svg';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { navigate } from '@/utils/navigation';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { addressUtils } from '@rabby-wallet/base-utils';

export const ImportSuccessScreen = () => {
  const colors = useThemeColors();
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
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

  const { switchAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const handleDone = React.useCallback(() => {
    contactService.setAlias({
      address: state.address,
      alias: aliasName || '',
    });
    Keyboard.dismiss();
    navigate(RootNames.StackRoot, {
      screen: RootNames.Home,
    });
  }, [aliasName, state.address]);

  const isFocus = useIsFocused();

  React.useEffect(() => {
    setAliasName(contactService.getAliasByAddress(state.address)?.alias || '');
  }, [state]);

  React.useEffect(() => {
    setTimeout(() => fetchAccounts(), 0);
  }, [fetchAccounts]);

  React.useEffect(() => {
    if (isFocus) {
      const targetAccount = accounts.find(
        a =>
          a.brandName === state.brandName &&
          addressUtils.isSameAddress(a.address, state.address),
      );
      const currentAccount = preferenceService.getCurrentAccount();
      if (targetAccount) {
        if (
          !currentAccount ||
          targetAccount.brandName !== currentAccount.brandName ||
          !addressUtils.isSameAddress(currentAccount.address, state.address)
        ) {
          switchAccount(targetAccount);
        }
      }
    }
  }, [isFocus, state, accounts, switchAccount]);

  return (
    <RootScreenContainer hideBottomBar style={styles.rootContainer}>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
        }}>
        <View style={styles.keyboardView}>
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
        </View>
      </TouchableWithoutFeedback>
      <FooterButton title="Done" onPress={handleDone} />
      <FocusAwareStatusBar backgroundColor={colors['blue-default']} />
    </RootScreenContainer>
  );
};
