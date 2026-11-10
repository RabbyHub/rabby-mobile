import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import type { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TouchableOpacity, View } from 'react-native';
import { PerpsPositionItem } from './PerpsPositionItem';
import { useMemoizedFn } from 'ahooks';
import { Text } from '@/components/Typography';
import {
  createPerpsPositionMarketSelector,
  getPerpsPositionRows,
} from './perpsPositionDisplay';

const PerpsPositionRow = React.memo(function PerpsPositionRow({
  row,
  onShowRiskPopup,
}: {
  row: PositionAndOpenOrder;
  onShowRiskPopup: (coin: string) => void;
}) {
  const coin = row.position.coin;
  const navigation = useRabbyAppNavigation();
  const selectMarket = useMemo(
    () => createPerpsPositionMarketSelector(coin),
    [coin],
  );
  const marketData = useActivityStore(perpsStore, selectMarket, Object.is, {
    storeLabel: 'perps-position-row',
  });
  const onPress = useMemoizedFn(() => {
    // Position navigation deliberately differs from a market-list press:
    // no scroll-to-top, fromSource, or showOpenPosition override.
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: { market: coin },
    });
  });

  return (
    <PerpsPositionItem
      item={row.position}
      openOrders={row.openOrders}
      marketData={marketData}
      onPress={onPress}
      onShowRiskPopup={onShowRiskPopup}
    />
  );
});

type PerpsPositionSectionProps = {
  positionAndOpenOrders?: PositionAndOpenOrder[];
  handleShowRiskPopup: (coin: string) => void;
  handleCloseRiskPopup: () => void;
  handleActionApproveStatus: () => Promise<void>;
  onCloseAllPositions: () => Promise<void>;
};

export const PerpsPositionSection = React.memo(function PerpsPositionSection({
  positionAndOpenOrders,
  handleShowRiskPopup,
  handleActionApproveStatus,
  onCloseAllPositions,
}: PerpsPositionSectionProps) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const list = useMemo(
    () => getPerpsPositionRows(positionAndOpenOrders),
    [positionAndOpenOrders],
  );

  const handleCloseAll = useMemoizedFn(async () => {
    await handleActionApproveStatus();
    Alert.alert(
      t('page.perps.closeAllConfirmTitle'),
      t('page.perps.closeAllConfirmMessage'),
      [
        {
          text: t('global.cancel'),
          style: 'default',
        },
        {
          text: t('global.confirm'),
          style: 'default',
          onPress: () => {
            onCloseAllPositions();
          },
        },
      ],
    );
  });

  if (!positionAndOpenOrders?.length) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleBar} />
          <Text style={styles.sectionTitle}>{t('page.perps.positions')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            handleCloseAll();
          }}>
          <Text style={styles.sectionActionText}>
            {t('page.perps.closeAll')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {list.map(({ key, row }) => (
          <PerpsPositionRow
            key={key}
            row={row}
            onShowRiskPopup={handleShowRiskPopup}
          />
        ))}
      </View>
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
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
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  sectionAction: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
  },
  sectionActionIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}));
