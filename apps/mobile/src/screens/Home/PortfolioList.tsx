import React, { useCallback, useState, useMemo } from 'react';
import type { ListRenderItem } from 'react-native';
import { View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { FullDefiRenderItem } from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useIsFocused } from '@react-navigation/native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { useSingleHomeAccount, useSingleHomeChain } from './hooks/singleHome';
import useProtocols, {
  EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
  getSingleProtocolsCacheKey,
  protocolEntityResourceStore,
  type ProtocolEntityId,
  useProtocolListComputedStore,
} from '@/store/protocols';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import type { KeyringAccountWithAlias } from '@/hooks/account';

type PortfolioListItem =
  | {
      type: 'defi';
      protocolId: ProtocolEntityId;
    }
  | {
      type: 'empty-defi' | 'loading-defi-skeleton';
      data: string;
    };

const ProtocolResourceRow = React.memo(
  ({
    protocolId,
    account,
    disableAction,
    defaultExpand,
  }: {
    protocolId: ProtocolEntityId;
    account?: KeyringAccountWithAlias | null;
    disableAction: boolean;
    defaultExpand: boolean;
  }) => {
    const protocol = useActivityStore(
      protocolEntityResourceStore.useStore,
      state => state.valueMap[protocolId],
      Object.is,
      { storeLabel: 'single-address-protocol-entities' },
    );

    if (!protocol) {
      return <DefiItemLoader />;
    }

    return (
      <FullDefiRenderItem
        data={protocol}
        showAccount={false}
        disableAction={disableAction}
        defaultExpand={defaultExpand}
        account={account}
      />
    );
  },
);

const getPortfolioListItemId = (item: PortfolioListItem) => {
  if ('protocolId' in item) {
    return `${item.type}/${item.protocolId}`;
  }
  return `${item.type}/${item.data}`;
};

interface Props {
  onForeground?: () => void;
  onRefresh?: () => void | Promise<void>;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;

export const PortfolioList = ({ onForeground, onRefresh }: Props) => {
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();
  const { selectedChain } = useSingleHomeChain();

  const lowerAddress = useMemo(
    () => currentAccount?.address?.toLowerCase(),
    [currentAccount?.address],
  );

  const focusedTab = useFocusedTab();

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'defi';
    return currentFocused;
  }, [focusedTab]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isScreenFocused = useIsFocused();

  const loadingPortfolio = useActivityStore(
    useProtocols,
    state => {
      if (!lowerAddress) {
        return false;
      }
      const hasSnapshot = Object.prototype.hasOwnProperty.call(
        state.protocolMap,
        lowerAddress,
      );
      return (
        !!state.isLoadingByAddress[lowerAddress] ||
        (!state.hasLoadedByAddress[lowerAddress] && !hasSnapshot)
      );
    },
    Object.is,
    { storeLabel: 'single-address-protocols' },
  );

  const updatePortfolio = useProtocols.getState().getProtocols;

  const singleProtocolsKey = useMemo(() => {
    if (!lowerAddress) {
      return null;
    }
    return getSingleProtocolsCacheKey(lowerAddress, selectedChain);
  }, [lowerAddress, selectedChain]);

  const protocolIndex = useActivityStore(
    useProtocolListComputedStore,
    state =>
      singleProtocolsKey
        ? state.singleProtocolsIndexCache[singleProtocolsKey] ||
          EMPTY_PROTOCOL_ASSETS_INDEX_RESULT
        : EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
    Object.is,
    { storeLabel: 'single-address-computed-protocols' },
  );

  const shouldDefaultExpand = useMemo(
    () => protocolIndex.protocolIds.length <= 5,
    [protocolIndex.protocolIds.length],
  );

  const dataList = useMemo(() => {
    const defiList: PortfolioListItem[] = protocolIndex.protocolIds.map(
      protocolId => ({
        type: 'defi',
        protocolId,
      }),
    );

    const itemData: Array<{
      show: boolean;
      data: PortfolioListItem[];
    }> = [
      {
        show: true,
        data: defiList,
      },
      {
        show: !!loadingPortfolio && !defiList.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: 'index-defi' + index.toString(),
        })),
      },
      {
        show: !loadingPortfolio && defiList.length === 0,
        data: [
          {
            type: 'empty-defi',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Defi'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [loadingPortfolio, protocolIndex.protocolIds, t]);

  const refreshPortfolioList = useCallback(() => {
    if (!lowerAddress) {
      return;
    }
    updatePortfolio(lowerAddress);
  }, [lowerAddress, updatePortfolio]);

  useAppForeground({
    enabled: isFocused,
    onForeground: () => {
      if (loadingPortfolio || !isFocused || !lowerAddress) {
        return;
      }
      onForeground?.();
      refreshPortfolioList();
    },
  });

  const renderItem = useCallback<ListRenderItem<PortfolioListItem>>(
    props => {
      const { item: _data } = props;
      const { type } = _data;
      switch (type) {
        case 'defi':
          return (
            <ProtocolResourceRow
              protocolId={_data.protocolId}
              disableAction={loadingPortfolio}
              defaultExpand={shouldDefaultExpand}
              account={currentAccount}
            />
          );
        case 'empty-defi':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={_data.data || ''}
              type={type}
            />
          );
        case 'loading-defi-skeleton':
          return <DefiItemLoader />;
        default:
          return null;
      }
    },
    [currentAccount, loadingPortfolio, shouldDefaultExpand, styles.emptyAssets],
  );
  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  const scrollY = useCurrentTabScrollY();
  const handleScrollIndicatorChange = useCallback(
    (showIndicator: boolean) => setShowScrollIndicator(showIndicator),
    [],
  );

  useAnimatedReaction(
    () => scrollY.value >= 89,
    (showIndicator, previousShowIndicator) => {
      if (showIndicator === previousShowIndicator) {
        return;
      }
      runOnJS(handleScrollIndicatorChange)(showIndicator);
    },
  );
  return (
    <View style={styles.container}>
      <Tabs.FlatList
        data={dataList}
        keyExtractor={getPortfolioListItemId}
        renderItem={renderItem}
        // estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        windowSize={4}
        maxToRenderPerBatch={15}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={async () => {
              if (!lowerAddress) {
                return;
              }
              setIsManualRefreshing(true);
              try {
                const balanceRefresh = Promise.resolve().then(() =>
                  onRefresh?.(),
                );
                const portfolioRefresh = updatePortfolio?.(lowerAddress, true);
                withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(
                  error => {
                    console.error('Refresh balance failed:', error);
                  },
                );
                await portfolioRefresh;
              } finally {
                setIsManualRefreshing(false);
              }
            }}
            refreshing={isScreenFocused && isManualRefreshing}
          />
        }
      />
    </View>
  );
};

const getStyles = createGetStyles2024(_ctx => ({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  list: {
    flex: 1,
  },
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  emptyAssets: {
    //backgroundColor: 'transparent',
    //height: '100%',
    //marginTop: -100,
  },
  defiLoading: {
    marginTop: 16,
  },
}));
