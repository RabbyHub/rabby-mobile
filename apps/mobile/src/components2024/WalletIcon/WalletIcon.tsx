import { useTheme2024 } from '@/hooks/theme';
import {
  getWalletAvator2024,
  getWalletIcon2024,
  showSubWalletIcon,
} from '@/utils/walletInfo2024';
import {
  KEYRING_TYPE,
  KEYRING_CLASS,
  WALLET_NAME,
} from '@rabby-wallet/keyring-utils';
import { useMemo, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import { Image } from 'react-native';
import { useAccountStore } from '@/store/account';
import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;

type EValue = `${KEYRING_TYPE}`;

export interface WalletIconProps {
  type?: keyof typeof WALLET_NAME | EValue | string;
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
  const accounts = useAccountStore(s => s.accounts);
  const isWatchAddress = useMemo(() => {
    if (type !== KEYRING_CLASS.WATCH) return undefined;
    if (!address) return true;
    return accounts.some(
      a =>
        a.brandName === KEYRING_CLASS.WATCH &&
        isSameAddress(a.address, address),
    );
  }, [type, address, accounts]);
  const avatar = useMemo(
    () => getWalletAvator2024(type, isLight, address, isWatchAddress),
    [type, isLight, address, isWatchAddress],
  );
  const Icon = getWalletIcon2024(type, isLight, isWatchAddress);
  const styleProps = style ? StyleSheet.flatten(style) : {};
  const {
    width: styleWidth,
    height: styleHeight,
    borderRadius: styleBorderRadius,
  } = styleProps;
  const [size, setSize] = useState(Number(styleWidth?.valueOf() || width));
  const borderRadius = _borderRadius || 14 * (size / 40);
  const subWalletContainerSize = (19 * size) / 40;
  const subWalletIconSize = (15.7 * size) / 40;
  const subWalletIconBorderWidth = (2 * size) / 40;
  const subWalletIconBorderRadius = (5 * size) / 40;

  if (!avatar) {
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
        source={avatar}
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
            top: -subWalletIconBorderWidth,
            left: -subWalletIconBorderWidth,
            width: subWalletContainerSize,
            height: subWalletContainerSize,
            borderWidth: subWalletIconBorderWidth,
            borderColor: 'white',
            backgroundColor: 'white',
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
