import React, { useMemo } from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { useFindChain } from '@/hooks/useFindChain';
import { getTokenIcon } from '@/utils/tokenIcon';
import { CHAINS_ENUM } from '@debank/common';

const TokenIcon = ({
  tokenSymbol,
  chain,
  size = 46,
  chainSize,
}: {
  tokenSymbol: string;
  chain?: string;
  size?: number;
  chainSize?: number;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const chainInfo = useFindChain({
    enum: chain || CHAINS_ENUM.ETH,
  });

  const TokenIconComponent = useMemo(
    () => getTokenIcon(tokenSymbol),
    [tokenSymbol],
  );

  return (
    <View style={styles.container}>
      {/* token icon */}
      <View style={[styles.tokenIcon, { width: size, height: size }]}>
        {TokenIconComponent ? (
          <TokenIconComponent width={size} height={size} />
        ) : (
          <View style={[styles.defaultIcon, { width: size, height: size }]} />
        )}
      </View>

      {/* chain icon */}
      {chainInfo?.logo && chainSize && (
        <FastImage
          source={{ uri: chainInfo.logo }}
          style={[
            styles.chainIcon as FastImageProps['style'],
            { width: chainSize, height: chainSize },
          ]}
        />
      )}
    </View>
  );
};

export default TokenIcon;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
  },
  tokenIcon: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-1'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultIcon: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 14,
  },
  chainIcon: {
    width: 12,
    height: 12,
    position: 'absolute',
    backgroundColor: colors2024['neutral-bg-2'],
    right: -2,
    bottom: -2,
    borderRadius: 6,
  },
}));
