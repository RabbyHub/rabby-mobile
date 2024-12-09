import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { isNumber } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckBoxRect } from '../CheckBox';

export type ViewAccount = {
  address: string;
  index: number;
  balance?: number | null;
};

export interface Props {
  account: ViewAccount;
  onPress?: () => void;
  isImported?: boolean;
  isSelected?: boolean;
}

export const AccountListItem: React.FC<Props> = ({
  account,
  onPress,
  isSelected,
  isImported,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const address = React.useMemo(
    () => ellipsisAddress(account.address),
    [account.address],
  );

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <Text style={styles.addressText}>{address}</Text>
        {isNumber(account.balance) && (
          <Text style={styles.balanceText}>
            {formatUsdValue(account.balance)}
          </Text>
        )}
        {isImported && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Imported</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={StyleSheet.flatten([
          {
            opacity: isImported ? 0.5 : 1,
          },
        ])}
        onPress={onPress}
        hitSlop={10}>
        <CheckBoxRect checked={isImported || isSelected} />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingRight: 24,
  },
  left: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
  },
  badgeText: {
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
  },
  addressText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  balanceText: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
