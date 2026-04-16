import React, { useEffect, useMemo } from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/components/Typography';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { formatPercentageKMB } from '@/screens/Watchlist/components/priceChange';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { create } from 'zustand';

const ETH_UUID = 'eth:eth';
type ETHStatusStore = {
  ethToken: TokenDetailWithPriceCurve | null;
  setEthToken: (token: TokenDetailWithPriceCurve | null) => void;
};

const useETHStatusStore = create<ETHStatusStore>(set => ({
  ethToken: null,
  setEthToken: token => set({ ethToken: token }),
}));

export const refreshETHStatus = async () => {
  try {
    const [token] = await openapi.getTokensDetailByUuids([ETH_UUID]);
    useETHStatusStore.getState().setEthToken(token || null);
  } catch (error) {
    console.error('get ETH status error', error);
  }
};

export const ETHStatus = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const ethToken = useETHStatusStore(s => s.ethToken);

  useEffect(() => {
    refreshETHStatus();
  }, []);

  const priceChange = ethToken?.price_24h_change;
  const priceChangeText = useMemo(() => {
    if (typeof priceChange !== 'number') {
      return null;
    }
    return formatPercentageKMB(priceChange);
  }, [priceChange]);

  const isPositive = (priceChange || 0) > 0;
  const isZeroChange = priceChange === 0;

  if (!ethToken || !priceChangeText) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Image
        source={
          ethToken.logo_url
            ? { uri: ethToken.logo_url }
            : isLight
            ? require('@/assets/icons/token/default-token.png')
            : require('@/assets/icons/token/default-token-dark.png')
        }
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: isZeroChange
              ? colors2024['neutral-secondary']
              : isPositive
              ? colors2024['green-default']
              : colors2024['red-default'],
          },
        ]}>
        {priceChangeText}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));
