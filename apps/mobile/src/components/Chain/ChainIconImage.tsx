import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import React, { useMemo } from 'react';
import { Image, ImageProps, StyleSheet } from 'react-native';

export default function ChainIconImage({
  chainEnum,
  source,
  size = 20,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    source?: ImageProps['source'];
    size?: number;
    chainEnum?: string;
  }
>) {
  const chainLogoUri = useMemo(
    () => findChainByEnum(chainEnum, { fallback: CHAINS_ENUM.ETH })!.logo,
    [chainEnum],
  );

  return (
    <Image
      width={size}
      height={size}
      {...props}
      source={source || { uri: chainLogoUri }}
      style={[{ height: size, width: size }, props.style]}
    />
  );
}
