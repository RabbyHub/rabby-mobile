import { useTheme2024 } from '@/hooks/theme';
import {
  getWalletAvator2024,
  getWalletIcon2024,
  showSubWalletIcon,
} from '@/utils/walletInfo2024';
import { KEYRING_TYPE, WALLET_NAME } from '@rabby-wallet/keyring-utils';
import { ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import { Image } from 'react-native';

type EValue = `${KEYRING_TYPE}`;

export interface WalletIconProps {
  type: keyof typeof WALLET_NAME | EValue | string;
  style?: StyleProp<ImageStyle>;
  width?: number;
  height?: number;
  borderRadius?: number;
  address?: string;
}

export const WalletIcon: React.FC<WalletIconProps> = ({
  type,
  style,
  width = 40,
  height = 40,
  borderRadius = 14,
  address,
}) => {
  const { isLight } = useTheme2024();
  const avator = getWalletAvator2024(type, isLight, address);
  const Icon = getWalletIcon2024(type, isLight);
  if (!avator) {
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
  }
  return (
    <View
      style={StyleSheet.flatten([
        {
          borderRadius,
          width,
          height,
          position: 'relative',
        },
        style,
      ])}>
      <Image
        source={avator}
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
      {Icon && showSubWalletIcon(type) && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 27,
            height: 27,
            borderWidth: 3,
            borderColor: 'white',
            borderRadius: 7,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Image
            source={Icon}
            style={{
              width: 23,
              height: 23,
              borderRadius: 7,
            }}
          />
        </View>
      )}
    </View>
  );
};
