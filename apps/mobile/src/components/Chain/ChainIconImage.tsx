import { findChain } from '@/utils/chain';
import React, { useMemo } from 'react';
import { Image, ImageProps } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { SvgXml } from 'react-native-svg';
import { TestnetChainLogo } from './TestnetChainLogo';

export default function ChainIconImage({
  chainEnum,
  chainServerId,
  chainId,
  source,
  size = 20,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    source?: ImageProps['source'];
    size?: number;
    chainEnum?: string;
    chainServerId?: string;
    chainId?: number;
  }
>) {
  const chain = useMemo(() => {
    return findChain({
      id: chainId,
      enum: chainEnum,
      serverId: chainServerId,
    });
  }, [chainEnum, chainId, chainServerId]);

  if (chain?.isTestnet) {
    return (
      <TestnetChainLogo size={size} style={props.style} name={chain.name} />
    );
  }

  return (
    <Image
      width={size}
      height={size}
      {...props}
      source={source || { uri: chain?.logo }}
      style={[{ height: size, width: size }, props.style]}
    />
  );
}

export function ChainIconFastImage({
  chainEnum,
  chainServerId,
  chainId,
  source,
  size = 20,
  ...props
}: {
  size?: number;
  chainEnum?: string;
  chainServerId?: string;
  chainId?: number;
} & FastImageProps) {
  const chain = useMemo(() => {
    return findChain({
      id: chainId,
      enum: chainEnum,
      serverId: chainServerId,
    });
  }, [chainEnum, chainId, chainServerId]);

  if (chain?.isTestnet) {
    return (
      <TestnetChainLogo
        size={size}
        style={props.style as any}
        name={chain.name}
      />
    );
  }

  return (
    <FastImage
      {...props}
      source={source || { uri: chain?.logo }}
      style={[{ height: size, width: size }, props.style]}
    />
  );
}

ChainIconImage.Fast = ChainIconFastImage;
