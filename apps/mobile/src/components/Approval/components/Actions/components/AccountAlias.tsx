import { StyleSheet, View, Text } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useAlias } from '@/hooks/alias';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      flexDirection: 'row', // Assuming you want a row layout
      alignItems: 'center',
      fontSize: 13,
      color: colors['neutral-body'], // Default color if --r-neutral-body is not available
    },
    iconAccount: {
      width: 16,
      marginRight: 4,
    },
  });

const AccountAlias = ({ address }: { address: string }) => {
  const [alias] = useAlias(address);
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();

  if (!address) return null;

  return (
    <View style={styles.wrapper}>
      {/* <img
        style={styles.iconAccount}
        src={
          WALLET_BRAND_CONTENT[account.brandName]?.image ||
          KEYRING_ICONS[account.type]
        }
      /> */}
      <Text className="flex-1" style={commonStyle.secondaryText}>
        {alias}
      </Text>
    </View>
  );
};

export default AccountAlias;
