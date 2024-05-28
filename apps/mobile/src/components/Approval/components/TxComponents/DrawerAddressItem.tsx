import React, { useMemo } from 'react';
import clsx from 'clsx';
// import { Account } from 'background/service/preference';
// import { NameAndAddress } from 'ui/component';
// import FieldCheckbox from 'ui/component/FieldCheckbox';
// import IconTagYou from 'ui/assets/tag-you.svg';
// import IconTagNotYou from 'ui/assets/tag-notyou.svg';
// import { KEYRING_TYPE, KEYRING_CLASS } from 'consts';
import { useTranslation } from 'react-i18next';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringAccountWithAlias as Account } from '@/hooks/account';
import { NameAndAddress } from '@/components/NameAndAddress';
import { RcIconTagYou, RcIconTagNotYou } from '@/assets/icons/address';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCheckedCC } from '@/assets/icons/common';

export const ownerPriority = [
  KEYRING_TYPE.SimpleKeyring,
  KEYRING_CLASS.MNEMONIC,
  KEYRING_CLASS.HARDWARE.LEDGER,
  KEYRING_CLASS.HARDWARE.ONEKEY,
  // KEYRING_CLASS.HARDWARE.TREZOR,
  // KEYRING_CLASS.HARDWARE.BITBOX02,
  KEYRING_CLASS.WALLETCONNECT,
  KEYRING_CLASS.WATCH,
];

export interface AddressItemProps {
  account: Account;
  signed: boolean;
  onSelect(account: Account): void;
  checked: boolean;
}

export const AddressItem = ({
  account,
  signed,
  onSelect,
  checked,
}: AddressItemProps) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        if (!account.type || signed) {
          return;
        }
        onSelect(account);
      }}
      style={[styles.container, checked && styles.checked]}>
      <View style={styles.main}>
        <NameAndAddress
          nameStyle={[styles.name, !account.type && styles.disabled]}
          addressStyle={[styles.address, !account.type && styles.disabled]}
          address={account.address}
          style={styles.nameAndAddress}
        />

        {account.type ? <RcIconTagYou /> : <RcIconTagNotYou />}
      </View>

      {signed ? (
        <View>
          <Text style={styles.signedText}>
            {t('page.signTx.safeAdminSigned')}
          </Text>
        </View>
      ) : null}
      {!(!account.type || signed) ? (
        <>
          {checked ? (
            <RcIconCheckedCC
              width={24}
              height={24}
              color={colors['green-default']}
            />
          ) : (
            <RcIconCheckedCC
              width={24}
              height={24}
              color={colors['neutral-line']}
            />
          )}
        </>
      ) : null}
    </TouchableWithoutFeedback>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 8,
      backgroundColor: colors['neutral-card-2'],
      marginBottom: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 52,
    },
    checked: {
      borderColor: colors['blue-default'],
    },
    disabled: {
      color: colors['neutral-foot'],
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      gap: 12,
      minWidth: 0,
    },
    nameAndAddress: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 18,
      color: colors['neutral-title-1'],
      marginRight: 8,
    },
    address: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-body'],
      fontWeight: '400',
    },
    signedText: {
      fontSize: 14,
      lineHeight: 18,
      color: colors['green-default'],
      marginLeft: 'auto',
    },
  });
