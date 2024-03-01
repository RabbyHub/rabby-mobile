import { FocusAwareStatusBar, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { contactService, preferenceService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import {
  useIsFocused,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import React from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { AddressInput } from './components/AddressInput';
import ImportSuccessSVG from '@/assets/icons/address/import-success.svg';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { addressUtils } from '@rabby-wallet/base-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RcIconRightCC } from '@/assets/icons/common';
import { navigate } from '@/utils/navigation';

type ImportSuccessScreenProps = NativeStackScreenProps<RootStackParamsList>;

export const ImportSuccessScreen = () => {
  const colors = useThemeColors();
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const navigation = useNavigation<ImportSuccessScreenProps['navigation']>();
  const { safeOffHeader } = useSafeSizes();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        rootContainer: {
          display: 'flex',
          backgroundColor: colors['blue-default'],
        },
        list: {
          rowGap: 14,
          flex: 1,
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
          rowGap: 16,
        },
        keyboardView: {
          flex: 1,
          height: '100%',
          backgroundColor: colors['neutral-bg-2'],
        },
        ledgerButton: {
          backgroundColor: colors['neutral-bg-2'],
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 32,
        },
        ledgerButtonText: {
          color: colors['blue-default'],
          fontSize: 14,
        },
      }),

    [colors, safeOffHeader],
  );
  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportSuccess)?.params,
  ) as {
    address: string | string[];
    brandName: string;
    deepLink: string;
    isLedgerFirstImport: boolean;
  };
  const [importAddresses, setImportAddresses] = React.useState<
    {
      address: string;
      aliasName: string;
    }[]
  >([]);

  const { switchAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const handleDone = React.useCallback(() => {
    importAddresses.forEach(item => {
      contactService.setAlias({
        address: item.address,
        alias: item.aliasName,
      });
    });
    Keyboard.dismiss();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackRoot,
          params: {
            screen: RootNames.Home,
          },
        },
      ],
    });
  }, [importAddresses, navigation]);

  const isFocus = useIsFocused();

  React.useEffect(() => {
    const addresses = Array.isArray(state.address)
      ? state.address
      : [state.address];

    setImportAddresses(
      addresses.map(address => ({
        address,
        aliasName: contactService.getAliasByAddress(address)?.alias || '',
      })),
    );
  }, [state]);

  React.useEffect(() => {
    setTimeout(() => fetchAccounts(), 0);
  }, [fetchAccounts]);

  React.useEffect(() => {
    if (!importAddresses.length) {
      return;
    }
    const lastAddress = importAddresses[importAddresses.length - 1].address;
    if (isFocus) {
      const targetAccount = accounts.find(
        a =>
          a.brandName === state.brandName &&
          addressUtils.isSameAddress(a.address, lastAddress),
      );
      const currentAccount = preferenceService.getCurrentAccount();
      if (targetAccount) {
        if (
          !currentAccount ||
          targetAccount.brandName !== currentAccount.brandName ||
          !addressUtils.isSameAddress(currentAccount.address, lastAddress)
        ) {
          switchAccount(targetAccount);
        }
      }
    }
  }, [isFocus, state, accounts, switchAccount, importAddresses]);

  const handleImportLedger = React.useCallback(() => {
    navigate(RootNames.ImportLedger, {});
  }, []);

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
          <ScrollView automaticallyAdjustKeyboardInsets>
            <View style={styles.inputContainer}>
              {importAddresses.map((item, index) => (
                <AddressInput
                  key={item.address}
                  address={item.address}
                  aliasName={item.aliasName}
                  onChange={_aliasName => {
                    const newImportAddresses = [...importAddresses];
                    newImportAddresses[index] = {
                      address: item.address,
                      aliasName: _aliasName,
                    };
                    setImportAddresses(newImportAddresses);
                  }}
                />
              ))}
            </View>
          </ScrollView>
          {state.isLedgerFirstImport && (
            <TouchableOpacity
              onPress={handleImportLedger}
              style={styles.ledgerButton}>
              <Text style={styles.ledgerButtonText}>Import more address</Text>
              <RcIconRightCC
                width={16}
                height={16}
                color={colors['blue-default']}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableWithoutFeedback>

      <FooterButton title="Done" onPress={handleDone} />
      <FocusAwareStatusBar backgroundColor={colors['blue-default']} />
    </RootScreenContainer>
  );
};
