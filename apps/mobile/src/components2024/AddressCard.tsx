import React from 'react';
import { View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ellipsisAddress } from '@/utils/address';
import { formatNetworth } from '@/utils/math';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import addressBalanceStore from '@/store/balance';

// Balance component that handles its own data fetching with loading and error states
interface BalanceProps {
  address: string;
}

const Balance: React.FC<BalanceProps> = ({ address }) => {
  const { styles } = useTheme2024({ getStyle });

  const balance = addressBalanceStore.useAddressValue(address);

  // Fetch balance on mount if not available
  React.useEffect(() => {
    if (!balance && address) {
      addressBalanceStore.getTotalBalance(address, true);
    }
  }, [address, balance]);

  if (!balance) {
    return (
      <View style={styles.balanceLoadingContainer}>
        <ActivityIndicator size="small" color={styles.balanceLoading.color} />
      </View>
    );
  }

  return (
    <Text style={styles.balanceText}>
      {formatNetworth(balance.totalBalance)}
    </Text>
  );
};

export interface AddressCardProps {
  /**
   * Wallet address to display
   */
  address: string;
  /**
   * Wallet brand name for avatar
   */
  brandName: string;
  /**
   * Optional alias name to display above address
   */
  aliasName?: string;
  /**
   * Whether to show balance (only shown in import mode)
   */
  showBalance?: boolean;
  /**
   * Optional custom style for the container
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional avatar size (default: 36, or 46 when showBalance is true)
   */
  avatarSize?: number;
  /**
   * Optional avatar border radius (default: 12)
   */
  avatarBorderRadius?: number;
}

/**
 * AddressCard - A card-style component for displaying wallet addresses
 */
export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  brandName,
  aliasName,
  showBalance = false,
  style,
  avatarSize,
  avatarBorderRadius = 12,
}) => {
  const { styles } = useTheme2024({ getStyle });

  const displayAddress = aliasName || ellipsisAddress(address);

  // Default avatar size is 36, but 46 when showing balance
  const effectiveAvatarSize = avatarSize ?? (showBalance ? 46 : 36);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <WalletIcon
          type={brandName}
          address={address}
          width={effectiveAvatarSize}
          height={effectiveAvatarSize}
          borderRadius={avatarBorderRadius}
        />
        <View style={styles.textContainer}>
          <Text style={styles.addressText}>{displayAddress}</Text>
          {showBalance && <Balance address={address} />}
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    minHeight: 70,
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  addressText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  balanceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    marginTop: 4,
  },
  balanceLoadingContainer: {
    height: 20,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  balanceLoading: {
    color: colors2024['neutral-line'],
  },
}));

export default AddressCard;
