import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useGasAccountSign } from '../hooks/atom';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';

export const GasAccountCurrentAddress = ({
  style,
}: {
  style?: ViewProps['style'];
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { account } = useGasAccountSign();

  if (!account) {
    return null;
  }

  return (
    <View style={[styles.currentAddressContainer, style]}>
      <AddressItem account={account as any} fetchAccount={false}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View style={styles.addressRow}>
            <WalletIcon style={styles.walletIcon} />
            <View style={styles.addressTexts}>
              <View style={styles.nameRow}>
                <WalletName style={styles.addressText} />
              </View>

              <WalletBalance style={styles.balanceText} />
            </View>
          </View>
        )}
      </AddressItem>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  currentAddressContainer: {
    borderRadius: 20,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    padding: 16,
    height: 78,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },

  addressText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  balanceText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  walletIcon: {
    width: 40,
    height: 40,
  },
  addressTexts: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}));
