import {
  AccountHistoryItem,
  MarketDataMap,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  ListRenderItem,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PerpsHistoryAccountItem } from './PerpsHistoryAccountItem';
import { PerpsHistoryDetailPopup } from './PerpsHistoryDetailPopup';
import { PerpsHistoryEmpty } from './PerpsHistoryEmpty';
import { PerpsHistoryItem } from './PerpsHistoryItem';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import RcArrowRight2CC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';

export const PerpsHistorySection: React.FC<{
  marketDataMap: MarketDataMap;
  historyList?: (AccountHistoryItem | WsFill)[];
  coin?: string;
}> = ({ marketDataMap, historyList: list, coin }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const displayedList = useMemo(() => {
    return (list || []).slice(0, 3);
  }, [list]);

  const {
    state: { fillsOrderTpOrSl },
  } = usePerpsStore();

  const [selectedFill, setSelectedFill] = useState<
    (WsFill & { logoUrl: string }) | null
  >(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const navigation = useRabbyAppNavigation();

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

  return (
    <>
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('page.perps.history.title')}
          </Text>
          {(list?.length || 0) > 3 ? (
            <TouchableOpacity
              onPress={() => {
                navigation.push(RootNames.StackTransaction, {
                  screen: RootNames.PerpsHistory,
                  params: {
                    coin,
                  },
                });
              }}>
              <View style={styles.sectionAction}>
                <Text style={styles.sectionActionText}>
                  {t('page.perps.more')}
                </Text>
                <RcArrowRight2CC color={colors2024['neutral-foot']} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.content}>
          {list?.length ? (
            <>
              {displayedList.map(item => {
                return 'usdValue' in item ? (
                  <PerpsHistoryAccountItem data={item} key={item.hash} />
                ) : (
                  <PerpsHistoryItem
                    fill={item}
                    orderTpOrSl={fillsOrderTpOrSl[item.oid]}
                    onPress={handleItemClick}
                    marketData={marketDataMap}
                    key={item.hash}
                  />
                );
              })}
            </>
          ) : (
            <PerpsHistoryEmpty />
          )}
        </View>
      </View>

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
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}));
