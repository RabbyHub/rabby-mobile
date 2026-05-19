import React, { useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMemoizedFn } from 'ahooks';

import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

import { PerpsLimitOrderItem } from './PerpsLimitOrderItem';
import { PerpsLimitOrderDetailPopup } from './PerpsLimitOrderDetailPopup';
import { LimitOrderRow } from '../../hooks/useLimitOrders';
import { usePerpsPosition } from '@/screens/PerpsMarketDetail/hooks/usePerpsPosition';

type Props = {
  rows: LimitOrderRow[];
  handleActionApproveStatus: () => Promise<void>;
  isHome?: boolean;
};

export const PerpsLimitOrdersSectionView: React.FC<Props> = ({
  rows,
  isHome,
  handleActionApproveStatus,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const marketDataMap = perpsStore(s => s.marketDataMap);
  const { handleCancelLimitOrders } = usePerpsPosition();
  const [activeRow, setActiveRow] = useState<LimitOrderRow | null>(null);

  const handleCancelAll = useMemoizedFn(async () => {
    await handleActionApproveStatus();
    Alert.alert(
      t('page.perps.cancelAllOrdersConfirmTitle'),
      t('page.perps.cancelAllOrdersConfirmMessage'),
      [
        { text: t('global.cancel'), style: 'default' },
        {
          text: t('global.confirm'),
          style: 'default',
          onPress: () => handleCancelLimitOrders(rows.map(r => r.order)),
        },
      ],
    );
  });

  const handleConfirmSingleCancel = useMemoizedFn(async () => {
    if (!activeRow) {
      return;
    }
    await handleActionApproveStatus();
    const ok = await handleCancelLimitOrders([activeRow.order]);
    if (ok) {
      setActiveRow(null);
    }
  });

  if (!rows.length) {
    return null;
  }

  return (
    <View style={[styles.container, isHome && styles.homeContainer]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleBar} />
          <Text style={styles.sectionTitle}>{t('page.perps.limitOrders')}</Text>
        </View>
        <TouchableOpacity onPress={handleCancelAll}>
          <Text style={styles.sectionActionText}>
            {t('page.perps.cancelAll')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {rows.map(row => (
          <PerpsLimitOrderItem
            key={row.order.oid}
            order={row.order}
            leverage={row.leverage}
            marginUsage={row.marginUsage}
            marketData={marketDataMap[row.order.coin]}
            onPress={() => setActiveRow(row)}
          />
        ))}
      </View>

      <PerpsLimitOrderDetailPopup
        visible={!!activeRow}
        order={activeRow?.order}
        leverage={activeRow?.leverage}
        marginUsage={activeRow?.marginUsage}
        marketData={activeRow ? marketDataMap[activeRow.order.coin] : undefined}
        onClose={() => setActiveRow(null)}
        onCancel={handleConfirmSingleCancel}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  homeContainer: {
    marginTop: 24,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitleBar: {
    width: 4,
    height: 20,
    borderRadius: 100,
    backgroundColor: '#50D2C1',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  sectionActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
  },
  content: { flexDirection: 'column', gap: 8 },
}));
