import { RcIconLong } from '@/assets2024/icons/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ListRenderItemInfo,
  SectionList,
  Text,
  Touchable,
  TouchableOpacity,
  View,
} from 'react-native';
import { PerpsPositionItem } from './PerpsPositionItem';
import { head } from 'lodash';
import { useMemoizedFn } from 'ahooks';
import { red } from 'bn.js';
import { PerpsMarketItem } from './PerpsMarketItem';
import { RcArrowRight2CC } from '@/assets/icons/common';
import { PerpsHistoryEmpty } from './PerpsHistoryEmpty';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import {
  AccountHistoryItem,
  MarketData,
  MarketDataMap,
  PositionAndOpenOrder,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { PerpsHistoryItem } from './PerpsHistorySection/PerpsHistoryItem';

export const PerpsMain: React.FC<{
  ListHeaderComponent?: React.ReactElement;
  marketData: MarketData[];
  positionAndOpenOrders?: PositionAndOpenOrder[];
  marketDataMap: MarketDataMap;
  homeHistoryList?: (AccountHistoryItem | WsFill)[];
}> = ({
  ListHeaderComponent,
  marketData,
  positionAndOpenOrders,
  marketDataMap,
  homeHistoryList,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();

  const sections = useMemo(() => {
    const res = [
      positionAndOpenOrders?.length
        ? {
            title: 'Positions',
            type: 'position' as const,
            data: positionAndOpenOrders.map(item => {
              return {
                type: 'position' as const,
                item: item,
              };
            }),
          }
        : null,
      {
        title: 'Explore Perps',
        type: 'market' as const,
        data: marketData.slice(0, 3).map(item => {
          return {
            type: 'market' as const,
            item: item,
          };
        }),
      },
      {
        title: 'History',
        type: 'history' as const,
        data: (homeHistoryList || [])?.map(item => {
          return {
            type: 'history',
            item: item,
          };
        }),
      },
    ].filter(item => !!item);
    return res;
  }, [homeHistoryList, marketData, positionAndOpenOrders]);

  const {
    state: { fillsOrderTpOrSl },
  } = usePerpsStore();

  const renderItem = useMemoizedFn(
    ({
      item: row,
    }: ListRenderItemInfo<
      | {
          type: 'position';
          item: PositionAndOpenOrder;
        }
      | {
          type: 'market';
          item: MarketData;
        }
      | {
          type: 'history';
          item: any;
        }
    >) => {
      if (row.type === 'position') {
        return (
          <PerpsPositionItem
            item={row.item.position}
            marketData={marketDataMap[row.item.position.coin]}
            onPress={() => {
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.PerpsMarketDetail,
                params: {
                  market: row.item.position.coin,
                },
              });
            }}
          />
        );
      }
      if (row.type === 'market') {
        return (
          <PerpsMarketItem
            item={row.item}
            onPress={() => {
              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.PerpsMarketDetail,
                params: {
                  market: row.item.name,
                },
              });
            }}
          />
        );
      }
      if (row.type === 'history') {
        return 'usdValue' in row.item ? null : (
          <PerpsHistoryItem
            fill={row.item}
            orderTpOrSl={fillsOrderTpOrSl[row.item.oid]}
            // onClick={handleItemClick}
            marketData={marketDataMap}
            key={row.item.hash}
          />
        );
      }
      return null;
    },
  );

  const renderSectionHeader = useMemoizedFn(
    ({ section }: { section: (typeof sections)[number] }) => {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.type === 'market' ? (
              <TouchableOpacity
                onPress={() => {
                  navigation.push(RootNames.StackTransaction, {
                    screen: RootNames.PerpsMarketList,
                  });
                }}>
                <View style={styles.sectionAction}>
                  <Text style={styles.sectionActionText}>{t('View All')}</Text>
                  <RcArrowRight2CC color={colors2024['neutral-foot']} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
          {section.type === 'history' && !section.data?.length ? (
            <PerpsHistoryEmpty />
          ) : null}
        </>
      );
    },
  );

  return (
    <SectionList
      sections={sections as any}
      style={styles.list}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={{
        paddingBottom: 56,
      }}
      // onScrollBeginDrag={onScrollBeginDrag}
      // style={[styles.chainListContainer, style]}
      // keyExtractor={(item, idx) => `${item.enum}-${idx}`}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      ItemSeparatorComponent={() => (
        <View
          style={{
            height: 8,
          }}
        />
      )}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  list: {
    // flex: 1,
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
    fontSize: 16,
    lineHeight: 20,
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
}));
