import { useTheme2024 } from '@/hooks/theme';
import { getWalletIcon2024 } from '@/utils/walletInfo2024';
import { KEYRING_TYPE, WALLET_NAME } from '@rabby-wallet/keyring-utils';
import { ImageStyle, StyleProp, StyleSheet } from 'react-native';
import { Image } from 'react-native';

type EValue = `${KEYRING_TYPE}`;

export interface WalletIconProps {
  type: keyof typeof WALLET_NAME | EValue | string;
  style?: StyleProp<ImageStyle>;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export const WalletIcon: React.FC<WalletIconProps> = ({
  type,
  style,
  width = 40,
  height = 40,
  borderRadius = 14,
}) => {
  const { isLight } = useTheme2024();
  const Icon = getWalletIcon2024(type, isLight);

  return (
    <Image
      source={Icon}
      width={width}
      height={height}
      style={StyleSheet.flatten([
        {
          borderRadius,
          width,
          height,
        },
        style,
      ])}
    />
  );
};
