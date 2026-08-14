import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import type { PerpsProOpenOrderEditMarketSnapshot } from '../../model/openOrderEdit';

export const PerpsProOpenOrderEditHeader: React.FC<{
  market: PerpsProOpenOrderEditMarketSnapshot;
  order: PerpsOpenOrderViewModel;
}> = React.memo(({ market, order }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const buy = order.side === 'buy';
  return (
    <View style={styles.container}>
      <View style={styles.pairRow}>
        <Text numberOfLines={1} style={styles.pair}>
          {market.displayPair}
        </Text>
        {market.sourceTag ? (
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>
              {market.sourceTag.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tags}>
        <View style={buy ? styles.buyTag : styles.sellTag}>
          <Text style={buy ? styles.buyText : styles.sellText}>
            {order.orderType}
          </Text>
        </View>
        <View style={buy ? styles.buyTag : styles.sellTag}>
          <Text style={buy ? styles.buyText : styles.sellText}>
            {t(
              buy
                ? 'page.perps.pro.openOrders.buy'
                : 'page.perps.pro.openOrders.sell',
            )}
          </Text>
        </View>
      </View>
    </View>
  );
});

PerpsProOpenOrderEditHeader.displayName = 'PerpsProOpenOrderEditHeader';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { gap: 8 },
  pairRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pair: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceTag: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 2,
    borderWidth: 0.5,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sourceText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  tags: { flexDirection: 'row', gap: 4 },
  buyTag: {
    backgroundColor: colors2024['green-light-1'],
    borderColor: colors2024['green-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sellTag: {
    backgroundColor: colors2024['red-light-1'],
    borderColor: colors2024['red-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  buyText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  sellText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
}));
