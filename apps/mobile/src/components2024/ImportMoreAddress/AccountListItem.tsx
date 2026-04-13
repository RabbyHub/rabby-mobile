import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue } from '@/utils/number';
import { isNumber } from 'lodash';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CheckBoxRect } from '../CheckBox';
import { WalletIcon } from '../WalletIcon/WalletIcon';
import { Text } from '@/components/Typography';

export type ViewAccount = {
  address: string;
  index: number;
  balance?: number | null;
};

export interface Props {
  account: ViewAccount;
  brandName: string;
  onPress?: () => void;
  isImported?: boolean;
  isSelected?: boolean;
}

export const AccountListItem: React.FC<Props> = ({
  account,
  brandName,
  onPress,
  isSelected,
  isImported,
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <WalletIcon
        type={brandName}
        address={account.address}
        width={46}
        height={46}
        style={styles.walletLogo}
      />
      <View style={styles.itemInfo}>
        <View style={styles.itemName}>
          <Text style={styles.itemNameText} numberOfLines={1}>
            {brandName} {account.index + 1}
          </Text>
          {isImported && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Imported</Text>
            </View>
          )}
        </View>
        {isNumber(account.balance) && (
          <Text style={styles.itemBalanceText}>
            {formatUsdValue(account.balance)}
          </Text>
        )}
      </View>
      <View style={isImported && styles.checkboxImported}>
        <CheckBoxRect checked={isImported || isSelected} />
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  item: {
    padding: 12,
    backgroundColor: colors2024['neutral-bg-0'],
    flexDirection: 'row',
    borderRadius: 12,
    alignItems: 'center',
  },
  checkboxImported: {
    opacity: 0.5,
  },
  walletLogo: {
    borderRadius: 12,
  },
  itemInfo: {
    marginLeft: 8,
    gap: 4,
    flex: 1,
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemNameText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  itemBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
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
}));
