import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { useTranslation } from 'react-i18next';

import { RcNextLeftCC } from '@/assets/icons/common';
import { Text } from '@/components/Typography';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  buildSpotOpenOrderItems,
  type SpotMarket,
  type SpotOpenOrderItem,
} from '@/hooks/perps/spot/spotMarkets';
import type { SpotOrderHistoryItem } from '@/hooks/perps/spot/spotOrderHistory';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useSpotOrderCancel } from '@/hooks/perps/spot/useSpotOrderCancel';
import { useSpotOrderHistory } from '@/hooks/perps/spot/useSpotOrderHistory';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { SpotOpenOrderRow } from './components/SpotOpenOrderRow';
import { SpotOrderHistoryRow } from './components/SpotOrderHistoryRow';

type OrdersTab = 'open' | 'history';

/**
 * Spot orders of the current Perps account across all pairs: open orders
 * (polled, cancellable) and closed orders (fetched when the tab is shown).
 */
export const PerpsSpotOrdersScreen: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<OrdersTab>('open');
  const { markets, account, currentPerpsAccount, refresh } = usePerpsSpotData({
    withAccount: true,
  });
  const { cancel, cancellingOid } = useSpotOrderCancel(
    currentPerpsAccount,
    refresh,
  );
  const history = useSpotOrderHistory({
    address: currentPerpsAccount?.address,
    markets,
    enabled: isFocused && tab === 'history' && markets.length > 0,
  });

  const openItems = useMemo(
    () => buildSpotOpenOrderItems(account?.openOrders, markets),
    [account?.openOrders, markets],
  );

  const handleCancel = useCallback(
    (market: SpotMarket, order: OpenOrder) =>
      cancel(market.pairIndex, order.oid),
    [cancel],
  );

  const handleOpenMarket = useCallback((market: SpotMarket) => {
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsSpotTrade,
      params: { pairIndex: market.pairIndex },
    });
  }, []);

  const renderOpenItem = useCallback(
    ({ item }: { item: SpotOpenOrderItem }) => (
      <SpotOpenOrderRow
        order={item.order}
        market={item.market}
        showPair
        cancelling={cancellingOid === item.order.oid}
        cancelDisabled={cancellingOid !== null}
        onCancel={handleCancel}
        onPress={handleOpenMarket}
      />
    ),
    [cancellingOid, handleCancel, handleOpenMarket],
  );

  const renderHistoryItem = useCallback(
    ({ item }: { item: SpotOrderHistoryItem }) => (
      <SpotOrderHistoryRow item={item} onPress={handleOpenMarket} />
    ),
    [handleOpenMarket],
  );

  const renderCenter = (content: React.ReactNode) => (
    <View style={styles.center}>{content}</View>
  );
  const renderMessage = (message: string) =>
    renderCenter(<Text style={styles.mutedText}>{message}</Text>);
  const spinner = renderCenter(
    <ActivityIndicator color={colors2024['neutral-foot']} />,
  );

  const renderBody = () => {
    if (!currentPerpsAccount) {
      return renderMessage(t('page.perpsSpot.loginRequired'));
    }
    if (tab === 'open') {
      if (!account || !markets.length) {
        return spinner;
      }
      return (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={openItems}
          keyExtractor={item => String(item.order.oid)}
          renderItem={renderOpenItem}
          ListEmptyComponent={renderMessage(t('page.perpsSpot.noOpenOrders'))}
        />
      );
    }
    if (history.isError) {
      return renderMessage(t('page.perpsSpot.historyLoadError'));
    }
    if (history.isLoading || !markets.length) {
      return spinner;
    }
    return (
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={history.items}
        keyExtractor={item => String(item.oid)}
        renderItem={renderHistoryItem}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefreshing}
            onRefresh={history.reload}
          />
        }
        ListEmptyComponent={renderMessage(t('page.perpsSpot.noHistory'))}
      />
    );
  };

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t('page.perpsSpot.ordersScreenTitle')}
        </Text>
      </View>
      <View style={styles.tabs}>
        {(['open', 'history'] as const).map(item => {
          const active = item === tab;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(item)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item === 'open'
                  ? t('page.perpsSpot.openTab', { count: openItems.length })
                  : t('page.perpsSpot.historyTab')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderBody()}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    paddingHorizontal: 20,
    paddingLeft: 14,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: colors2024['neutral-bg-1'] },
  tabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors2024['neutral-foot'],
  },
  tabTextActive: { color: colors2024['neutral-title-1'], fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  center: { paddingTop: 120, alignItems: 'center' },
  mutedText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
}));
