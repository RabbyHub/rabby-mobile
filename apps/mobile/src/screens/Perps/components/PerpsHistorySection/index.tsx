import {
  AccountHistoryItem,
  MarketDataMap,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ListRenderItem, Text, View } from 'react-native';
import { PerpsHistoryAccountItem } from './PerpsHistoryAccountItem';
import { PerpsHistoryDetailPopup } from './PerpsHistoryDetailPopup';
import { PerpsHistoryEmpty } from './PerpsHistoryEmpty';
import { PerpsHistoryItem } from './PerpsHistoryItem';

export const PerpsHistorySection: React.FC<{
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  marketDataMap: MarketDataMap;
  homeHistoryList?: (AccountHistoryItem | WsFill)[];
}> = ({
  ListHeaderComponent,
  ListFooterComponent,
  marketDataMap,
  homeHistoryList,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const list = homeHistoryList;

  const {
    state: { fillsOrderTpOrSl },
  } = usePerpsStore();

  const [selectedFill, setSelectedFill] = useState<
    (WsFill & { logoUrl: string }) | null
  >(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const handleItemClick = useMemoizedFn((fill: WsFill) => {
    const obj = {
      ...fill,
      logoUrl: marketDataMap[fill.coin.toUpperCase()]?.logoUrl || '',
    };
    setSelectedFill(obj);
    setDetailVisible(true);
  });

  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedFill(null);
  };

  const renderItem = useMemoizedFn<ListRenderItem<AccountHistoryItem | WsFill>>(
    ({ item }) => {
      return 'usdValue' in item ? (
        <PerpsHistoryAccountItem data={item} />
      ) : (
        <PerpsHistoryItem
          fill={item}
          orderTpOrSl={fillsOrderTpOrSl[item.oid]}
          onPress={handleItemClick}
          marketData={marketDataMap}
          key={item.hash}
        />
      );
    },
  );

  return (
    <>
      <FlatList
        data={list}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('page.perps.history.title')}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={<PerpsHistoryEmpty />}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.contentContainer}
        // onScrollBeginDrag={onScrollBeginDrag}
        // style={[styles.chainListContainer, style]}
        // keyExtractor={(item, idx) => `${item.enum}-${idx}`}
        // renderItem={renderItem}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />

      <PerpsHistoryDetailPopup
        visible={detailVisible}
        orderTpOrSl={
          selectedFill?.oid && fillsOrderTpOrSl[selectedFill.oid]
            ? fillsOrderTpOrSl[selectedFill.oid]
            : undefined
        }
        fill={selectedFill}
        onClose={handleCloseDetail}
      />
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  list: {},
  contentContainer: {
    paddingBottom: 56,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'right',
  },
  sectionActionIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  divider: {
    height: 8,
  },
}));
