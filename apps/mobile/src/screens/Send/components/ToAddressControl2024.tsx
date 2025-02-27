import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { WhiteListItemSwitch } from './WhiteListItem';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useWhitelist } from '@/hooks/whitelist';

export default function ToAddressControl2024({
  style,
  address,
  brandName,
}: React.PropsWithChildren<
  RNViewProps & {
    address: string;
    brandName?: string;
  }
>) {
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useAccounts();
  const { isAddrOnWhitelist } = useWhitelist();
  const account: KeyringAccountWithAlias = useMemo(() => {
    const currentExistAccount = accounts.find(
      item =>
        isSameAddress(item.address, address) && item.brandName === brandName,
    );
    if (currentExistAccount) {
      return currentExistAccount;
    }
    return {
      address,
      brandName: KEYRING_TYPE.WatchAddressKeyring,
      type: KEYRING_TYPE.WatchAddressKeyring,
    };
  }, [accounts, address, brandName]);
  const { t } = useTranslation();

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.To')}</Text>
      </View>
      <WhiteListItemSwitch
        account={account}
        inWhiteList={isAddrOnWhitelist(account.address)}
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    control: {
      width: '100%',
      marginBottom: 16,
      gap: 12,
    },

    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      maxWidth: '70%',
    },

    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    aliasLabelContainer: {
      borderRadius: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'solid',
      borderColor: colors2024['brand-light-1'],
      backgroundColor: colors2024['brand-light-1'],
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },

    disabledAliasEditButton: {},

    aliasEditIcon: {},

    aliasLabel: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },

    entryWhitelist: {
      marginLeft: 8,
    },

    inputContainer: {
      borderRadius: 30,
      flexShrink: 0,
      paddingHorizontal: 24,
      paddingVertical: 20,
      width: '100%',
      marginTop: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      alignItems: 'flex-start',
      height: 'auto',
      borderColor: colors2024['neutral-bg-2'],
    },

    inputContainerError: {
      borderColor: colors2024['red-default'],
    },

    input: {
      color: colors2024['neutral-title-1'],
      paddingHorizontal: 0,
      fontSize: 16,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginRight: 12,
    },

    inputWithoutValue: {
      fontWeight: '400',
    },

    scanButtonContainer: {
      marginRight: 24,
    },

    scanIcon: {
      color: colors2024['neutral-title-1'],
    },

    extraView: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 26,
      paddingTop: 8,
    },

    tip: {
      color: colors2024['red-default'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },

    textAddToContact: {
      color: colors2024['blue-default'],
      textDecorationLine: 'underline',
      marginLeft: 2,
      fontSize: 12,
    },
  };
});
