import { RcIconTagYou } from '@/assets/icons/address';
import { NameAndAddress } from '@/components/NameAndAddress';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

export const GnosisAdminItem = ({
  accounts,
  address,
  style,
}: {
  accounts: string[];
  address: string;
  style?: ViewStyle;
}) => {
  const addressInWallet = useMemo(
    () => accounts.find(addr => isSameAddress(addr, address)),
    [accounts, address],
  );
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.listItem, style]}>
      <View style={styles.listItemContent}>
        <NameAndAddress
          address={address}
          nameStyle={styles.aliasName}
          addressStyle={styles.address}
        />
        {addressInWallet ? <RcIconTagYou /> : null}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  listItem: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors2024['neutral-line'],
    paddingVertical: 13,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tag: {
    borderColor: colors2024['brand-default'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 90,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 12,
    lineHeight: 14,
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  aliasName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    marginRight: 4,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  address: {
    fontSize: 15,
    lineHeight: 18,
  },
}));
