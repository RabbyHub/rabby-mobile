import RcIconEmptyNft from '@/assets2024/singleHome/empty-nft.svg';
import RcIconEmptyNftDark from '@/assets2024/singleHome/empty-nft-dark.svg';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';
import RcIconEmptyToken from '@/assets2024/singleHome/empty-token.svg';
import RcIconEmptyTokenDark from '@/assets2024/singleHome/empty-token-dark.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Text, View, ViewProps, Image } from 'react-native';

export const EmptyAssets = ({
  style,
  desc = '',
  type = 'empty-assets',
}: {
  style?: ViewProps['style'];
  desc?: string | null;
  type?: 'empty-assets' | 'empty-defi' | 'empty-nft';
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const icon = useMemo(() => {
    switch (type) {
      case 'empty-defi':
        return (
          <Image
            source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
            width={160}
            height={120}
            style={{
              width: 163,
              height: 126,
            }}
          />
        );
      case 'empty-nft':
        return isLight ? <RcIconEmptyNft /> : <RcIconEmptyNftDark />;
      case 'empty-assets':
      default:
        return isLight ? <RcIconEmptyToken /> : <RcIconEmptyTokenDark />;
    }
  }, [type, isLight]);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.empty}>
        {icon}
        <Text style={styles.title}>{desc}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => ({
  container: {
    height: 195,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginHorizontal: 16,
  },
  empty: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 21,
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  desc: {
    color: colors['neutral-body'],
    fontSize: 14,
    lineHeight: 17,
  },
  image: {},
}));
