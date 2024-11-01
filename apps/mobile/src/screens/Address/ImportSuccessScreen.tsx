import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { contactService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import {
  useIsFocused,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  Keyboard,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Card } from '@/components2024/Card';

import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKRCategoryByType } from '@/utils/transaction';
import { Chain } from '@/constant/chains';
import { Button } from '@/components2024/Button';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';

type ImportSuccessScreenProps = NativeStackScreenProps<RootStackParamsList>;

export const ImportSuccessScreen = () => {
  const { styles } = useTheme2024({ getStyle });

  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const navigation = useNavigation<ImportSuccessScreenProps['navigation']>();

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportSuccess)?.params,
  ) as {
    address: string | string[];
    brandName: string;
    deepLink: string;
    isFirstImport: boolean;
    isFirstCreate: boolean;
    type: KEYRING_TYPE;
    supportChainList?: Chain[];
    mnemonics?: string;
    passphrase?: string;
    alias?: string;
    keyringId?: number;
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
        aliasName:
          state.isFirstCreate && state.alias
            ? state.alias
            : contactService.getAliasByAddress(address)?.alias || '',
      })),
    );

    matomoRequestEvent({
      category: 'Import Address',
      action: `Success_Import_${getKRCategoryByType(state.type)}`,
      label: state.brandName,
    });
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

  const WalletAddress = useCallback(
    ({ address, style }: { address: string; style?: StyleProp<TextStyle> }) => {
      return (
        <Text style={StyleSheet.flatten([styles.addressText, style])}>
          {ellipsisAddress(address)}
        </Text>
      );
    },
    [styles.addressText],
  );

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={styles.container}>
        {importAddresses.length === 1 ? (
          <View style={styles.itemContainer}>
            <WalletIcon
              type={state.type}
              width={100}
              height={100}
              style={styles.icon}
            />
            <TextInput
              editable={!state.isFirstCreate}
              style={styles.inputInner}
              value={importAddresses?.[0]?.aliasName || ''}
              onChange={nativeEvent => {
                const _aliasName = nativeEvent.nativeEvent.text;
                const newImportAddresses = [...importAddresses];
                newImportAddresses[0] = {
                  address: importAddresses?.[0]?.aliasName || '',
                  aliasName: _aliasName,
                };
                setImportAddresses(newImportAddresses);
              }}
              blurOnSubmit
              autoFocus
              clearButtonMode="while-editing"
            />
            <WalletAddress address={importAddresses?.[0]?.address || ''} />
          </View>
        ) : (
          importAddresses.map((item, index) => (
            <Card key={item.address} style={styles.addressItem}>
              <WalletIcon type={state.type} width={50} height={50} />
              <View>
                <TextInput
                  style={styles.listInput}
                  value={item.aliasName}
                  onChange={nativeEvent => {
                    const _aliasName = nativeEvent.nativeEvent.text;
                    const newImportAddresses = [...importAddresses];
                    newImportAddresses[index] = {
                      address: item.address,
                      aliasName: _aliasName,
                    };
                    setImportAddresses(newImportAddresses);
                  }}
                  blurOnSubmit
                  autoFocus
                  clearButtonMode="while-editing"
                />
                <WalletAddress address={item.address} />
              </View>
            </Card>
          ))
        )}
        <Text style={styles.resultTip}>
          {importAddresses.length > 1
            ? `${importAddresses.length} Addresses`
            : ''}
          &nbsp;Imported successfully!
        </Text>
        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title="Done"
          onPress={handleDone}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    marginTop: 233,
    borderRadius: 16,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  inputInner: {
    width: '100%',
    marginTop: 15,
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  resultTip: {
    width: '100%',
    marginTop: 28,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['blue-default'],
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 40,
  },
  addressItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 11,
    width: '100%',
  },
  listInput: {
    width: '100%',
    textAlignVertical: 'center',
    padding: 0,
    fontSize: 18.8,
    borderWidth: 0,
    backgroundColor: 'transparent',
    lineHeight: 25,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginBottom: 4,
  },
}));
