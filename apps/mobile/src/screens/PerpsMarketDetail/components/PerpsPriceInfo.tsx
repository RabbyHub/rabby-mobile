import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { splitNumberByStep } from '@/utils/number';
import { Text } from '@/components/Typography';

interface AssetPriceInfoProps {
  activeAssetCtx?: WsActiveAssetCtx['ctx'] | null;
  currentAssetCtx?: MarketData | null;
}

export const AssetPriceInfo = ({
  activeAssetCtx,
  currentAssetCtx,
}: AssetPriceInfoProps) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const markPrice = useMemo(() => {
    return Number(activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0);
  }, [activeAssetCtx, currentAssetCtx]);

  return (
    <View style={styles.section}>
      <Text style={styles.quote}>
        {t('page.perpsDetail.PerpsPriceInfo.current')}
      </Text>
      <Text style={styles.price}>{`$${splitNumberByStep(markPrice)}`}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  price: {
    marginLeft: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  name: {
    marginLeft: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  quote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
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
