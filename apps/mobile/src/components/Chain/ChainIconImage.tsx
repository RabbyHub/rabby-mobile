import { findChain } from '@/utils/chain';
import React, { useMemo } from 'react';
import { Image, ImageProps, View, ViewProps, ViewStyle } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { TestnetChainLogo } from './TestnetChainLogo';
import { RPCStatusBadge } from './RPCStatusBadge';

export default function ChainIconImage({
  chainEnum,
  chainServerId,
  chainId,
  source,
  size = 20,
  isShowRPCStatus,
  containerStyle,
  badgeStyle,
  badgeSize,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    source?: ImageProps['source'];
    size?: number;
    chainEnum?: string;
    chainServerId?: string;
    chainId?: number;
    isShowRPCStatus?: boolean;
    containerStyle?: ViewStyle;
    badgeStyle?: ViewStyle;
    badgeSize?: number;
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
      <View style={[containerStyle, { width: size, height: size }]}>
        <TestnetChainLogo size={size} style={props.style} name={chain.name} />
      </View>
    );
  }

  const Content = (
    <Image
      width={size}
      height={size}
      {...props}
      source={source || { uri: chain?.logo }}
      style={[{ height: size, width: size }, props.style]}
    />
  );

  if (isShowRPCStatus) {
    return (
      <RPCStatusBadge
        chainEnum={chain?.enum}
        size={size}
        badgeStyle={badgeStyle}
        badgeSize={badgeSize}
        style={containerStyle}>
        {Content}
      </RPCStatusBadge>
    );
  }

  return (
    <View style={[containerStyle, { width: size, height: size }]}>
      {Content}
    </View>
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
