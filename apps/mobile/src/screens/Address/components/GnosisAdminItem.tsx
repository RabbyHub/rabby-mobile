import { RcIconTagYou } from '@/assets/icons/address';
import { NameAndAddress } from '@/components/NameAndAddress';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
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
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
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

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    listItem: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
      paddingVertical: 13,
    },
    listItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tag: {
      borderColor: colors['blue-default'],
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 90,
      paddingHorizontal: 6,
      paddingVertical: 1,
      fontSize: 12,
      lineHeight: 14,
      color: colors['blue-default'],
    },
    aliasName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginRight: 4,
      lineHeight: 18,
    },
    address: {
      fontSize: 15,
      lineHeight: 18,
    },
  });
};
