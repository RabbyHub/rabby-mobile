import { CHAIN_ID_LIST } from '@/constant/projectLists';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useSwitch } from '@/hooks/useSwitch';
import { memo, ReactNode, useMemo } from 'react';
import { StyleSheet, View, Image, ImageStyle, ViewStyle } from 'react-native';
import FastImage from 'react-native-fast-image';

type AssetAvatarProps = {
  logo?: string;
  size?: number;
  chain?: string | false;
  chainSize?: number;
  failedPlaceholder?: ReactNode;
  style?: ViewStyle;
  logoStyle?: ViewStyle;
};

// 没有用 svg 因为在 虚拟列表中，会有问题
const DefaultToken = memo(
  ({ size = 28, style }: { size?: number; style?: ImageStyle }) => {
    return (
      <Image
        style={style}
        source={require('@/assets/icons/token/default-token.png')}
        width={size}
        height={size}
      />
    );
  },
);

export const AssetAvatar = memo(
  ({
    chain,
    logo,
    chainSize = 12,
    size = 28,
    style,
    logoStyle,
  }: AssetAvatarProps) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const { on, turnOn } = useSwitch();

    const chainLogo = useMemo(
      () =>
        chain
          ? {
              uri: CHAIN_ID_LIST.get(chain)?.logo_url,
            }
          : undefined,
      [chain],
    );

    const chainStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.imageBadge,
          { width: chainSize, height: chainSize, borderRadius: chainSize / 2 },
        ]),
      [chainSize],
    );

    const source = useMemo(
      () => ({
        uri: logo,
      }),
      [logo],
    );

    const avatarStyle = useMemo(() => ({ width: size, height: size }), [size]);

    const tokenStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.iconStyle,
          logoStyle,
          {
            width: size,
            height: size,
            borderRadius: logoStyle?.borderRadius ?? size / 2,
          },
        ]),
      [size, logoStyle],
    );

    const containerStyle = useMemo(
      () => StyleSheet.flatten([styles.imageBox, style]),
      [style],
    );

    return (
      <View style={containerStyle}>
        <View style={tokenStyle}>
          {!logo || on ? (
            <DefaultToken size={size} />
          ) : (
            <FastImage source={source} style={avatarStyle} onError={turnOn} />
          )}
        </View>
        {chainLogo ? <FastImage source={chainLogo} style={chainStyle} /> : null}
      </View>
    );
  },
);

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    imageBox: {
      position: 'relative',
    },
    iconStyle: {
      backgroundColor: colors['neutral-bg-1'],
      overflow: 'hidden',
    },
    imageBadge: {
      width: 12,
      height: 12,
      position: 'absolute',
      right: -2,
      top: -2,
    },
  });
