import React, { useMemo } from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  ViewStyle,
  View,
  Text,
  TextStyle,
} from 'react-native';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { formatPrice, formatUsdValue } from '@/utils/number';

interface ItemIconProps {
  tokenId: string;
  chainId: string;
  address: string;
  amount: number;
  singlePrice?: number;
  style?: StyleProp<TextStyle>;
}

export const HistoryItemTokenPrice = ({
  tokenId,
  chainId,
  address,
  amount,
  style,
  singlePrice,
}: ItemIconProps) => {
  // const { data: tokenWithPrice } = useRequest(
  //   async () => {
  //     if (!address || !tokenId || !chainId) {
  //       return null;
  //     }

  //     const res = await openapi.getToken(address, chainId, tokenId);
  //     return res;
  //   },
  //   {
  //     refreshDeps: [tokenId, chainId, amount, address],
  //   },
  // );

  return (
    <View>
      {Boolean(singlePrice) && (
        <Text style={style}>{`≈${formatUsdValue(singlePrice! * amount)}`}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width: 46,
    height: 46,
  },
  mediaInDetail: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  media: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  fromTokenBox: {
    position: 'absolute',
    left: 2,
    top: 2,
  },
  toTokenBox: {
    position: 'absolute',
    zIndex: 1,
    left: 12,
    top: 12,
  },
  imageBoxInDetail: {
    width: 58,
    height: 58,
  },
  imageBox: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  iconTR: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  iconBR: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
  },
});
