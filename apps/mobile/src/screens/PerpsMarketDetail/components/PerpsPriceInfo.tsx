import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent, formatUsdValueKMB } from '@/screens/Home/utils/price';
import { createGetStyles2024 } from '@/utils/styles';
import BigNumber from 'bignumber.js';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { AssetAvatar } from '@/components';
import { splitNumberByStep } from '@/utils/number';

interface AssetPriceInfoProps {
  coin: string;
  activeAssetCtx?: WsActiveAssetCtx['ctx'] | null;
  currentAssetCtx?: MarketData | null;
  logoUrl: string;
}

export const AssetPriceInfo = ({
  coin,
  logoUrl,
  activeAssetCtx,
  currentAssetCtx,
}: AssetPriceInfoProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const markPrice = useMemo(() => {
    return Number(activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0);
  }, [activeAssetCtx, currentAssetCtx]);

  const dayDelta = useMemo(() => {
    const prevDayPx = Number(
      activeAssetCtx?.prevDayPx || currentAssetCtx?.prevDayPx || 0,
    );
    return markPrice - prevDayPx;
  }, [activeAssetCtx, markPrice, currentAssetCtx]);

  const isPositiveChange = useMemo(() => {
    return dayDelta >= 0;
  }, [dayDelta]);

  const dayDeltaPercent = useMemo(() => {
    const prevDayPx = Number(
      activeAssetCtx?.prevDayPx || currentAssetCtx?.prevDayPx || 0,
    );
    return dayDelta / prevDayPx;
  }, [activeAssetCtx, currentAssetCtx, dayDelta]);

  return (
    <View style={styles.section}>
      <AssetAvatar logo={logoUrl} logoStyle={styles.icon} size={24} />
      <Text style={styles.name}>{coin}-USD</Text>
      <Text
        style={[
          styles.price,
          isPositiveChange ? styles.positive : styles.negative,
        ]}>
        {`${splitNumberByStep(markPrice)} (${
          isPositiveChange ? '+' : ''
        }${formatPercent(dayDeltaPercent, 2)})`}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
    flexDirection: 'row',
  },
  price: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 1000,
  },
  positive: {
    color: colors2024['green-default'],
  },
  negative: {
    color: colors2024['red-default'],
  },
}));
