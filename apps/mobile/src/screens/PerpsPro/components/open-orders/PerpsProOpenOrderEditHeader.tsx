import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import type { PerpsProOpenOrderEditMarketSnapshot } from '../../model/openOrderEdit';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
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
          <View
            style={styles.sourceTag}
            testID="perps-pro-open-order-edit-source">
            <Text style={styles.sourceText}>{market.sourceTag}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tags}>
        <View
          style={buy ? styles.buyTag : styles.sellTag}
          testID="perps-pro-open-order-edit-order-type-tag">
          <Text style={buy ? styles.buyText : styles.sellText}>
            {order.orderType}
          </Text>
        </View>
        <View
          style={buy ? styles.buyTag : styles.sellTag}
          testID="perps-pro-open-order-edit-side-tag">
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceTag: {
    alignItems: 'center',
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    justifyContent: 'center',
  },
  sourceText: getPerpsProMetadataTagTextStyle(colors2024),
  tags: { flexDirection: 'row', gap: 4 },
  buyTag: getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
  sellTag: getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
  buyText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
  sellText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
}));
