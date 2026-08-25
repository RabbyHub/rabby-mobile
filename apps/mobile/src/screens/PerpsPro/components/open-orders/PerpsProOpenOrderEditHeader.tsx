import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import type { PerpsProOpenOrderEditMarketSnapshot } from '../../model/openOrderEdit';
import {
  getPerpsProSemanticTagContainerStyle,
  getPerpsProSemanticTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

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
            <Text style={styles.sourceText}>{market.sourceTag}</Text>
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
    ...getPerpsProSemanticTagContainerStyle(colors2024, 'neutral', {
      backgroundColor: colors2024['neutral-bg-2'],
    }),
    justifyContent: 'center',
  },
  sourceText: getPerpsProSemanticTagTextStyle(colors2024, 'neutral'),
  tags: { flexDirection: 'row', gap: 4 },
  buyTag: getPerpsProSemanticTagContainerStyle(colors2024, 'positive'),
  sellTag: getPerpsProSemanticTagContainerStyle(colors2024, 'negative'),
  buyText: getPerpsProSemanticTagTextStyle(colors2024, 'positive'),
  sellText: getPerpsProSemanticTagTextStyle(colors2024, 'negative'),
}));
