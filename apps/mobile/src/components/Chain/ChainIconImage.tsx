import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@debank/common';
import React, { useMemo } from 'react';
import { Image, ImageProps, StyleSheet } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';

function useChainIcon({
  chainServerId,
  chainEnum,
}: {
  chainServerId?: Chain['serverId'];
  chainEnum?: CHAINS_ENUM | string;
}) {
  const chainLogoUri = useMemo(() => {
    if (chainServerId) {
      const foundChain = findChainByServerID(chainServerId);
      if (foundChain) return foundChain.logo;
    }

    return findChainByEnum(chainEnum, { fallback: CHAINS_ENUM.ETH })!.logo;
  }, [chainServerId, chainEnum]);

  return chainLogoUri;
}

export default function ChainIconImage({
  chainEnum,
  chainServerId,
  source,
  size = 20,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    source?: ImageProps['source'];
    size?: number;
    chainEnum?: string;
    chainServerId?: string;
  }
>) {
  const chainLogoUri = useChainIcon({ chainServerId, chainEnum });

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

export function ChainIconFastImage({
  chainEnum,
  chainServerId,
  source,
  size = 20,
  ...props
}: {
  size?: number;
  chainEnum?: string;
  chainServerId?: string;
} & FastImageProps) {
  const chainLogoUri = useChainIcon({ chainServerId, chainEnum });

  return (
    <FastImage
      {...props}
      source={source || { uri: chainLogoUri }}
      style={[{ height: size, width: size }, props.style]}
    />
  );
}

ChainIconImage.Fast = ChainIconFastImage;
