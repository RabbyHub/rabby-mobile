import { useTheme2024 } from '@/hooks/theme';
import {
  getWalletAvator2024,
  getWalletIcon2024,
  showSubWalletIcon,
} from '@/utils/walletInfo2024';
import { KEYRING_TYPE, WALLET_NAME } from '@rabby-wallet/keyring-utils';
import { useState } from 'react';
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
  borderRadius: _borderRadius,
  address,
}) => {
  const { isLight } = useTheme2024();
  const avator = getWalletAvator2024(type, isLight, address);
  const Icon = getWalletIcon2024(type, isLight);
  const styleProps = style ? StyleSheet.flatten(style) : {};
  const {
    width: styleWidth,
    height: styleHeight,
    borderRadius: styleBorderRadius,
  } = styleProps;
  const [size, setSize] = useState(Number(styleWidth?.valueOf() || width));
  const borderRadius = _borderRadius || 14 * (size / 40);
  const subWalletContainerSize = (27 * size) / 40;
  const subWalletIconSize = (23 * size) / 40;
  const subWalletIconBorderWidth = (3 * size) / 40;
  const subWalletIconBorderRadius = (7 * size) / 40;

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
      onLayout={evt => {
        setSize(evt.nativeEvent.layout.width);
      }}
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
            borderRadius: styleBorderRadius || borderRadius,
            width: styleWidth || width,
            height: styleHeight || height,
          },
        ])}
      />
      {Icon && showSubWalletIcon(type) && (
        <View
          style={{
            position: 'absolute',
            right: -subWalletIconBorderWidth,
            bottom: -subWalletIconBorderWidth,
            width: subWalletContainerSize,
            height: subWalletContainerSize,
            borderWidth: subWalletIconBorderWidth,
            borderColor: 'white',
            borderRadius: subWalletIconBorderRadius,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Image
            source={Icon}
            style={{
              width: subWalletIconSize,
              height: subWalletIconSize,
              borderRadius: subWalletIconBorderRadius,
            }}
          />
        </View>
      )}
    </View>
  );
};
