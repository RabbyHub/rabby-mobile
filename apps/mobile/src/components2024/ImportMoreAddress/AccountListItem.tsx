import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue } from '@/utils/number';
import { ellipsisAddress } from '@/utils/address';
import { isNumber } from 'lodash';
import React from 'react';
import { View } from 'react-native';
import { WalletIcon } from '../WalletIcon/WalletIcon';
import { Text } from '@/components/Typography';
import { SelectableAddressItem } from '../SelectableAddressItem';

export type ViewAccount = {
  address: string;
  index: number;
  balance?: number | null;
  aliasName?: string;
};

export interface Props {
  account: ViewAccount;
  brandName: string;
  onPress?: () => void;
  isImported?: boolean;
  isSelected?: boolean;
}

const ImportedBadge: React.FC = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Imported</Text>
    </View>
  );
};

export const AccountListItem: React.FC<Props> = ({
  account,
  brandName,
  onPress,
  isSelected,
  isImported,
}) => {
  const displayName = account.aliasName || ellipsisAddress(account.address);

  return (
    <SelectableAddressItem
      icon={
        <WalletIcon
          type={brandName}
          address={account.address}
          width={46}
          height={46}
          style={{ borderRadius: 12 }}
        />
      }
      title={displayName}
      balance={
        isNumber(account.balance) ? formatUsdValue(account.balance) : undefined
      }
      badge={isImported ? <ImportedBadge /> : undefined}
      selected={isImported || isSelected}
      disabled={isImported}
      onPress={onPress}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
