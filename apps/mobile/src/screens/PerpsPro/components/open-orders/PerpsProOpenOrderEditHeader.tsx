import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProLeverageConfiguration } from '../../model/leverage';
import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import type { PerpsProOpenOrderEditMarketSnapshot } from '../../model/openOrderEdit';
import { PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE } from '../common/perpsProDialogVisual';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

export const PerpsProOpenOrderEditHeader: React.FC<{
  market: PerpsProOpenOrderEditMarketSnapshot;
  leverageConfiguration?: PerpsProLeverageConfiguration | null;
}> = React.memo(({ market, leverageConfiguration }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
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
      {leverageConfiguration ? (
        <View
          style={styles.sourceTag}
          testID="perps-pro-open-order-edit-leverage">
          <Text style={styles.sourceText}>
            {t(
              leverageConfiguration.type === 'cross'
                ? 'page.perps.pro.positions.cross'
                : 'page.perps.pro.positions.isolated',
            )}{' '}
            {leverageConfiguration.value}x
          </Text>
        </View>
      ) : null}
    </View>
  );
});

PerpsProOpenOrderEditHeader.displayName = 'PerpsProOpenOrderEditHeader';

export const PerpsProOpenOrderEditDirection: React.FC<{
  order: PerpsOpenOrderViewModel;
}> = React.memo(({ order }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const buy = order.side === 'buy';
  const direction =
    order.editKind === 'limit'
      ? t(
          buy
            ? 'page.perps.pro.trade.buyLong'
            : 'page.perps.pro.trade.sellShort',
        )
      : `${order.orderType} / ${t(
          buy
            ? 'page.perps.pro.openOrders.buy'
            : 'page.perps.pro.openOrders.sell',
        )}`;
  return (
    <View style={styles.directionRow}>
      <Text style={styles.directionLabel}>
        {t('page.perps.pro.trade.direction')}
      </Text>
      <Text
        style={[styles.directionValue, buy ? styles.buyText : styles.sellText]}>
        {direction}
      </Text>
    </View>
  );
});

PerpsProOpenOrderEditDirection.displayName = 'PerpsProOpenOrderEditDirection';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  pairRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 24,
  },
  pair: {
    ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
  },
  sourceTag: {
    alignItems: 'center',
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    justifyContent: 'center',
  },
  sourceText: getPerpsProMetadataTagTextStyle(colors2024),
  directionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directionLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  directionValue: {
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  buyText: { color: colors2024['green-default'] },
  sellText: { color: colors2024['red-default'] },
}));
