import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { RcNextLeftCC } from '@/assets/icons/common';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { cancelAllPerpsSpotOrders } from '@/hooks/perps/spot/spotActions';
import { useSpotTokenLogos } from '@/hooks/perps/spot/spotLogos';
import {
  buildSpotBalanceItems,
  buildSpotOpenOrderItems,
  formatSpotPrice,
  getSpotMarketDisplayName,
  getSpotPortfolioValue,
  groupSpotOpenOrders,
  type SpotBalanceItem,
  type SpotMarket,
  type SpotOpenOrderGroup,
} from '@/hooks/perps/spot/spotMarkets';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useSpotOrderCancel } from '@/hooks/perps/spot/useSpotOrderCancel';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { SpotOpenOrderRow } from './components/SpotOpenOrderRow';

type Tab = 'balances' | 'orders';

const openMarket = (market: SpotMarket, side?: 'buy' | 'sell') =>
  naviPush(RootNames.StackTransaction, {
    screen: RootNames.PerpsSpotTrade,
    params: { pairIndex: market.pairIndex, side },
  });

const SpotBalanceRow: React.FC<{
  item: SpotBalanceItem;
  logo: string;
}> = React.memo(({ item, logo }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { balance, market, usdValue } = item;
  const hold = new BigNumber(balance.hold || 0);
  const available = new BigNumber(balance.total).minus(hold);
  const szDecimals = market?.szDecimals ?? 2;
  const fmt = (value: BigNumber) =>
    value.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN).toFixed();

  return (
    <View style={styles.balanceRow}>
      <AssetAvatar logo={logo} size={32} logoStyle={styles.avatar} />
      <View style={styles.balanceLeft}>
        <Text style={styles.rowTitle}>{balance.coin}</Text>
        <Text style={styles.rowSub}>
          {usdValue ? `≈ $${new BigNumber(usdValue).toFixed(2)}` : '-'}
          {hold.gt(0)
            ? ` · ${t('page.perpsSpot.lockedInOrders', { amount: fmt(hold) })}`
            : ''}
        </Text>
      </View>
      <View style={styles.balanceRight}>
        <Text style={styles.rowTitle}>{fmt(new BigNumber(balance.total))}</Text>
        {market ? (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => openMarket(market, 'sell')}>
            <Text style={styles.linkText}>{t('page.perpsSpot.sell')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.rowSub}>
            {t('page.perpsSpot.availableAmount', { amount: fmt(available) })}
          </Text>
        )}
      </View>
    </View>
  );
});

const SpotOrderGroupCard: React.FC<{
  group: SpotOpenOrderGroup;
  logo: string;
  cancellingOid: number | null;
  cancelDisabled: boolean;
  onCancel: (market: SpotMarket, order: OpenOrder) => void;
}> = React.memo(({ group, logo, cancellingOid, cancelDisabled, onCancel }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { market } = group;
  return (
    <View style={styles.groupCard}>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => openMarket(market)}>
        <AssetAvatar logo={logo} size={24} logoStyle={styles.avatar} />
        <Text style={styles.groupTitle}>
          {getSpotMarketDisplayName(market)}
        </Text>
        <Text style={styles.rowSub}>
          {t('page.perpsSpot.midLabel', {
            price: market.midPx
              ? formatSpotPrice(market.midPx, market.szDecimals)
              : '-',
          })}
        </Text>
      </TouchableOpacity>
      <View style={styles.groupBody}>
        {group.orders.map(order => (
          <SpotOpenOrderRow
            key={order.oid}
            order={order}
            market={market}
            cancelling={cancellingOid === order.oid}
            cancelDisabled={cancelDisabled}
            onCancel={onCancel}
          />
        ))}
      </View>
    </View>
  );
});

/** Spot balances and every open spot order of the current Perps account. */
export const PerpsSpotPortfolioScreen: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const [tab, setTab] = useState<Tab>('orders');
  const [cancellingAll, setCancellingAll] = useState(false);
  const cancelAllLockRef = useRef(false);
  const { markets, account, currentPerpsAccount, refresh } = usePerpsSpotData({
    withAccount: true,
  });
  const { cancel, cancellingOid } = useSpotOrderCancel(
    currentPerpsAccount,
    refresh,
  );

  const orderItems = useMemo(
    () => buildSpotOpenOrderItems(account?.openOrders, markets),
    [account?.openOrders, markets],
  );
  const groups = useMemo(() => groupSpotOpenOrders(orderItems), [orderItems]);
  const balanceItems = useMemo(
    () => buildSpotBalanceItems(account?.balances, markets),
    [account?.balances, markets],
  );
  const spotValue = useMemo(
    () => getSpotPortfolioValue(balanceItems),
    [balanceItems],
  );
  const logoMarkets = useMemo(
    () => [
      ...groups.map(group => group.market),
      ...balanceItems.map(item => ({ baseName: item.balance.coin })),
    ],
    [groups, balanceItems],
  );
  const logos = useSpotTokenLogos(logoMarkets);

  const handleCancel = useCallback(
    (market: SpotMarket, order: OpenOrder) =>
      cancel(market.pairIndex, order.oid),
    [cancel],
  );
  const handleCancelAll = useCallback(async () => {
    if (cancelAllLockRef.current || !orderItems.length) {
      return;
    }
    cancelAllLockRef.current = true;
    setCancellingAll(true);
    try {
      const ok = await cancelAllPerpsSpotOrders(
        currentPerpsAccount,
        orderItems.map(item => ({
          pairIndex: item.market.pairIndex,
          oid: item.order.oid,
        })),
      );
      if (ok) {
        refresh();
      }
    } finally {
      cancelAllLockRef.current = false;
      setCancellingAll(false);
    }
  }, [orderItems, currentPerpsAccount, refresh]);

  const cancelDisabled = cancellingOid !== null || cancellingAll;
  const renderGroup = useCallback(
    ({ item }: { item: SpotOpenOrderGroup }) => (
      <SpotOrderGroupCard
        group={item}
        logo={logos[item.market.baseName] || ''}
        cancellingOid={cancellingOid}
        cancelDisabled={cancelDisabled}
        onCancel={handleCancel}
      />
    ),
    [logos, cancellingOid, cancelDisabled, handleCancel],
  );
  const renderBalance = useCallback(
    ({ item }: { item: SpotBalanceItem }) => (
      <SpotBalanceRow item={item} logo={logos[item.balance.coin] || ''} />
    ),
    [logos],
  );

  const isLoading = !!currentPerpsAccount && (!account || !markets.length);

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('page.perpsSpot.portfolioTitle')}</Text>
      </View>
      {!currentPerpsAccount ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>
            {t('page.perpsSpot.loginRequired')}
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors2024['neutral-foot']} />
        </View>
      ) : (
        <>
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>
              {t('page.perpsSpot.spotValue')}
            </Text>
            <Text style={styles.value}>
              {`$${new BigNumber(spotValue).toFixed(2)}`}
            </Text>
          </View>
          <View style={styles.tabs}>
            {(['balances', 'orders'] as const).map(item => {
              const active = item === tab;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(item)}>
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}>
                    {item === 'balances'
                      ? t('page.perpsSpot.tabBalances')
                      : t('page.perpsSpot.tabOrders', {
                          count: orderItems.length,
                        })}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {tab === 'orders' && orderItems.length > 0 && (
              <TouchableOpacity
                style={styles.cancelAll}
                hitSlop={8}
                disabled={cancelDisabled}
                onPress={handleCancelAll}>
                {cancellingAll ? (
                  <ActivityIndicator
                    size="small"
                    color={colors2024['neutral-foot']}
                  />
                ) : (
                  <Text style={styles.cancelAllText}>
                    {t('page.perpsSpot.cancelAll')}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {tab === 'orders' ? (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={groups}
              keyExtractor={item => item.market.coin}
              renderItem={renderGroup}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.mutedText}>
                    {t('page.perpsSpot.noOpenOrders')}
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={balanceItems}
              keyExtractor={item => String(item.balance.token)}
              renderItem={renderBalance}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.mutedText}>
                    {t('page.perpsSpot.noBalances')}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    paddingHorizontal: 20,
    paddingLeft: 14,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  valueBlock: { paddingHorizontal: 20, paddingBottom: 12, gap: 2 },
  valueLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  tab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors2024['neutral-title-1'] },
  tabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
  tabTextActive: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  cancelAll: { marginLeft: 'auto', paddingVertical: 8 },
  cancelAllText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['red-default'],
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  center: { paddingTop: 120, alignItems: 'center' },
  mutedText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  avatar: { backgroundColor: colors2024['neutral-bg-2'] },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors2024['neutral-bg-3'],
  },
  groupTitle: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  groupBody: { paddingHorizontal: 14 },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  balanceLeft: { flex: 1, gap: 2 },
  balanceRight: { alignItems: 'flex-end', gap: 2 },
  rowTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  rowSub: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
