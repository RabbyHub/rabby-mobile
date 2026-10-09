import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useSpotOrderCancel } from '@/hooks/perps/spot/useSpotOrderCancel';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { SpotOpenOrderRow } from './components/SpotOpenOrderRow';

/** Every open spot order of the current Perps account, across all pairs. */
export const PerpsSpotOrdersScreen: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const { markets, account, currentPerpsAccount, refresh } = usePerpsSpotData({
    withAccount: true,
  });
  const { cancel, cancellingOid } = useSpotOrderCancel(
    currentPerpsAccount,
    refresh,
  );

  const items = useMemo(
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

  const renderItem = useCallback(
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

  const isLoading = !!currentPerpsAccount && (!account || !markets.length);

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t('page.perpsSpot.ordersTitle', { count: items.length })}
        </Text>
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
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={item => String(item.order.oid)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.mutedText}>
                {t('page.perpsSpot.noOpenOrders')}
              </Text>
            </View>
          }
        />
      )}
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
