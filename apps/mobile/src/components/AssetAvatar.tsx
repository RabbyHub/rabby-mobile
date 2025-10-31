import { AppColorsVariants } from '@/constant/theme';
import { useThemeStyles } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { useSwitch } from '@/hooks/useSwitch';
import { Chain } from '@debank/common';
import { memo, ReactNode, useMemo } from 'react';
import { Image, ImageStyle, StyleSheet, View, ViewStyle } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { TestnetChainLogo } from './Chain/TestnetChainLogo';
import { SvgUri } from 'react-native-svg';

type AssetAvatarProps = {
  logo?: string;
  size?: number;
  chain?: Chain['serverId'] | false;
  chainIconPosition?: 'tr' | 'br' | 'tl' | 'bl';
  chainSize?: number;
  failedPlaceholder?: ReactNode;
  style?: RNViewProps['style'];
  logoStyle?: ViewStyle;
  innerChainStyle?: ImageStyle | FastImageProps['style'];
};

// 没有用 svg 因为在 虚拟列表中，会有问题
export const DefaultToken = memo(
  ({
    size = 28,
    style,
    isLight = true,
  }: {
    size?: number;
    style?: ImageStyle;
    isLight?: boolean;
  }) => {
    return (
      <Image
        style={style}
        source={
          isLight
            ? require('@/assets/icons/token/default-token.png')
            : require('@/assets/icons/token/default-token-dark.png')
        }
        width={size}
        height={size}
      />
    );
  },
);

export const AssetAvatar = memo(
  ({
    chain,
    chainIconPosition = 'br',
    logo,
    chainSize = 12,
    size = 28,
    style,
    logoStyle,
    innerChainStyle,
  }: AssetAvatarProps) => {
    const { styles, isLight } = useThemeStyles(getStyles);
    const { on, turnOn } = useSwitch();

    const chainInfo = useFindChain({
      serverId: chain || null,
    });

    const chainStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.chainIcon,
          chainIconPosition === 'tl' && styles.chainIconTL,
          chainIconPosition === 'bl' && styles.chainIconBL,
          chainIconPosition === 'br' && styles.chainIconBR,
          chainIconPosition === 'tr' && styles.chainIconTR,
          innerChainStyle,
          { width: chainSize, height: chainSize, borderRadius: chainSize / 2 },
        ]),
      [chainSize, chainIconPosition, styles, innerChainStyle],
    );

    const source = useMemo(
      () => ({
        uri: logo,
      }),
      [logo],
    );

    const isSvgLogo = useMemo(
      () =>
        typeof logo === 'string' &&
        /\.svg(\?|$)/i.test(logo) &&
        /^https?:\/\//i.test(logo),
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
      [size, logoStyle, styles.iconStyle],
    );

    const containerStyle = useMemo(
      () => StyleSheet.flatten([styles.imageBox, style]),
      [style, styles.imageBox],
    );

    return (
      <View style={containerStyle}>
        <View style={tokenStyle}>
          {!logo || on ? (
            <DefaultToken size={size} style={avatarStyle} isLight={isLight} />
          ) : isSvgLogo ? (
            <DefaultToken size={size} style={avatarStyle} isLight={isLight} />
          ) : (
            <FastImage
              source={source}
              style={avatarStyle}
              onError={turnOn}
              key={logo}
            />
          )}
        </View>
        {chainInfo?.isTestnet ? (
          <TestnetChainLogo
            name={chainInfo.name}
            style={chainStyle as ImageStyle}
            size={chainSize}
          />
        ) : chainInfo?.logo ? (
          <FastImage
            source={{ uri: chainInfo.logo }}
            style={chainStyle as FastImageProps['style']}
          />
        ) : null}
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    chainIcon: {
      width: 12,
      height: 12,
      position: 'absolute',
      backgroundColor: colors['neutral-bg-2'],
    },
    chainIconTL: {
      left: -2,
      top: -2,
    },
    chainIconBL: {
      left: -2,
      bottom: -2,
    },
    chainIconTR: {
      right: -2,
      top: -2,
    },
    chainIconBR: {
      right: -2,
      bottom: -2,
    },
  });
