import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ellipsisAddress } from '@/utils/address';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';

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
   * Optional custom style for the container
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional avatar size (default: 36)
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
  style,
  avatarSize = 36,
  avatarBorderRadius = 12,
}) => {
  const { styles } = useTheme2024({ getStyle });

  const displayAddress = ellipsisAddress(address);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <WalletIcon
          type={brandName}
          address={address}
          width={avatarSize}
          height={avatarSize}
          borderRadius={avatarBorderRadius}
        />
        <View style={styles.textContainer}>
          {aliasName ? (
            <Text style={styles.aliasText} numberOfLines={1}>
              {aliasName}
            </Text>
          ) : null}
          <Text style={styles.addressText}>{displayAddress}</Text>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    width: '100%',
    height: 70,
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  aliasText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    marginBottom: 2,
  },
  addressText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
}));

export default AddressCard;
