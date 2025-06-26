/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import {
  makeTxPageBackgroundColors,
  RootNames,
  ScreenLayouts,
} from '@/constant/layout';
import { openapi } from '@/core/request';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { findChain, findChainByServerID } from '@/utils/chain';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import {
  SkeletonTokenListItem,
  TokenListItem,
} from './component/TokenListItem';
import { CHAINS_ENUM } from '@/constant/chains';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTipsDollarDialog } from './component/hooks';
import { preferenceService } from '@/core/services/shared';
import RcIconArrowDownCC from '@/assets2024/icons/copyTrading/IconDownPolygon.svg';
import RcIconSelectedCC from '@/assets2024/icons/copyTrading/IconSelected.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { Skeleton } from '@rneui/themed';
import { Tip } from '@/components';

const DEFAULT_COUNT = 10;

const DEFAULT_COMING_CHAIN_ID = ['base', 'eth', 'bsc', 'avax'];

enum FilterRuleEnum {
  '24hPrice' = '24hPrice',
  'smart money' = 'smart money',
  'token create' = 'token create',
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SkeletonTabList = React.memo(() => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const itemWidth = (SCREEN_WIDTH - 16 * 2) / 4 - 12;

  return (
    <>
      <Skeleton
        width={itemWidth}
        height={32}
        style={{ borderRadius: 100, marginRight: 8 }}
      />
      <Skeleton
        width={itemWidth}
        height={32}
        style={{ borderRadius: 100, marginRight: 8 }}
      />
      <Skeleton
        width={itemWidth}
        height={32}
        style={{ borderRadius: 100, marginRight: 8 }}
      />
      <Skeleton
        width={itemWidth}
        height={32}
        style={{ borderRadius: 100, marginRight: 0 }}
      />
    </>
  );
});

export const CopyTradingScreen = () => {
  const { t } = useTranslation();
  const [chainIdList, setChainIdList] = useState<string[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [tokenList, setTokenList] = useState<CopyTradeTokenItem[]>([]);
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [filterRule, setFilterRule] = useState<FilterRuleEnum>(
    FilterRuleEnum['24hPrice'],
  );
  const { navigation } = useSafeSetNavigationOptions();
  const [tabLoading, setTabLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUpdateCount, setCurrentUpdateCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const filterTabList = useMemo(() => {
    return [
      {
        key: FilterRuleEnum['24hPrice'],
        title: t('page.copyTrading.filterRule.24HChange'),
        rule: '24H Change',
      },
      {
        key: FilterRuleEnum['smart money'],
        title: t('page.copyTrading.filterRule.smartMoney'),
        rule: 'Amount',
      },
      {
        key: FilterRuleEnum['token create'],
        title: t('page.copyTrading.filterRule.tokenCreate'),
        rule: 'Time',
      },
    ];
  }, [t]);

  const selectedFilterRule = useMemo(() => {
    return filterTabList.find(item => item.key === filterRule);
  }, [filterRule, filterTabList]);

  const { chainList, comingChainList } = useMemo(() => {
    const list = chainIdList
      .map(chainId => findChainByServerID(chainId))
      .filter(item => Boolean(item?.enum));
    const comingList = DEFAULT_COMING_CHAIN_ID.filter(
      id => !chainIdList.includes(id),
    ).slice(0, 4 - list.length);
    return {
      chainList: list,
      comingChainList: comingList
        .map(chainId => findChainByServerID(chainId))
        .filter(item => Boolean(item?.enum)),
    };
  }, [chainIdList]);

  const fetchChainList = useMemoizedFn(async () => {
    try {
      setTabLoading(true);
      const chainIdArr = await openapi.getCopyTradingChainList();
      setChainIdList(chainIdArr);
      console.log('fetchChainList chainIdArr', chainIdArr);
      return chainIdArr;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return [];
    } finally {
      setTabLoading(false);
    }
  });

  const fetchTokenList = useMemoizedFn(
    async (chainId: string, startTime: number, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setListLoading(true);
        }

        const { token_list } = await openapi.getCopyTradingTokenList({
          chain_id: chainId,
          limit: DEFAULT_COUNT,
          start_time: startTime,
        });

        // check if there is more data
        const hasMoreData = token_list.length >= DEFAULT_COUNT;
        setHasMore(hasMoreData);

        return token_list;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        isLoadMore && setHasMore(false);
        return [];
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setListLoading(false);
        }
      }
    },
  );

  const handleOpenMenu = useMemoizedFn(() => {
    setIsMenuVisible(true);
  });

  const handleCloseMenu = useMemoizedFn(() => {
    setIsMenuVisible(false);
  });

  const handleSelectMenuItem = useMemoizedFn((selectedRule: FilterRuleEnum) => {
    if (filterRule !== selectedRule) {
      setFilterRule(selectedRule);
      // 切换筛选规则时重新获取数据
      if (selectedChainId) {
        setHasMore(true);
        fetchTokenList(selectedChainId, 0).then(tokenArr => {
          setTokenList(tokenArr);
        });
      }
    }
    handleCloseMenu();
  });

  const initFetchData = useMemoizedFn(async () => {
    setTabLoading(true);
    setListLoading(true);
    setHasMore(true);
    const chainIdArr = await fetchChainList();

    setChainIdList(chainIdArr);
    setSelectedChainId(chainIdArr[0]);
    const tokenArr = await fetchTokenList(chainIdArr[0], 0);
    setTokenList(tokenArr);
  });

  const handleChainItemPress = useMemoizedFn(async (chainId: string) => {
    if (chainId === selectedChainId) {
      return;
    }
    setSelectedChainId(chainId);
    setHasMore(true);
    const tokenArr = await fetchTokenList(chainId, 0);
    setTokenList(tokenArr);
  });

  const handleBuyPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    const chain = findChain({
      serverId: item.chain,
    });
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.MultiSwap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: item?.id,
        type: 'Buy',
        payUseBaseToken: true,
      },
    });
  });

  const handleTokenItemPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    console.log('handleTokenItemPress item', item);
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RECENTLY_BUY_LIST,
      tradingTokenItem: item,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  });

  const { showTipsDollarDialog } = useTipsDollarDialog();

  // fetch more data
  const handleLoadMore = useMemoizedFn(async () => {
    if (loadingMore || !hasMore || tokenList.length === 0) {
      return;
    }

    // get the last item's time_at as the start_time of the next page
    const lastItem = tokenList[tokenList.length - 1];
    const nextStartTime = lastItem.create_at;

    const moreTokens = await fetchTokenList(
      selectedChainId,
      nextStartTime,
      true,
    );

    if (moreTokens.length > 0) {
      // deduplication, avoid adding the same token
      setTokenList(prev => {
        const existingIds = new Set(prev.map(token => token.id));
        const newTokens = moreTokens.filter(
          token => !existingIds.has(token.id),
        );
        return [...prev, ...newTokens];
      });
    }
  });

  const checkCountUpdate = useMemoizedFn(
    (
      newTokenList: CopyTradeTokenItem[],
      oldTokenList: CopyTradeTokenItem[],
    ) => {
      const oldFirst = oldTokenList[0];
      const index = newTokenList.findIndex(token => token.id === oldFirst.id);
      if (index === -1) {
        setCurrentUpdateCount(10);
      } else {
        setCurrentUpdateCount(index);
      }
    },
  );

  useEffect(() => {
    if (currentUpdateCount > 0) {
      setTimeout(() => {
        setCurrentUpdateCount(0);
      }, 3000);
    }
  }, [currentUpdateCount]);

  // render list footer
  const renderListFooter = useMemoizedFn(() => {
    if (!loadingMore && hasMore) {
      return null;
    }

    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonTokenListItem key={index} />
          ))}
        </View>
      );
    }

    if (!hasMore && tokenList.length > 0) {
      return (
        <View style={styles.footerLoading}>
          <Text style={styles.noMoreText}>
            {t('page.copyTrading.noMoreData')}
          </Text>
        </View>
      );
    }

    return null;
  });

  useEffect(() => {
    initFetchData();
  }, [initFetchData]);

  useEffect(() => {
    const hasOpenCopyTrading = preferenceService.getHasOpenCopyTrading();
    if (!hasOpenCopyTrading) {
      preferenceService.setHasOpenCopyTrading(true);
      showTipsDollarDialog();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NormalScreenContainer type="bg1" noHeader={true}>
      <View style={styles.headerContainer}>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={handleOpenMenu}>
            <Text style={styles.filterText}>{selectedFilterRule?.rule}</Text>
            <RcIconArrowDownCC
              width={8}
              color={colors2024['brand-default']}
              style={[
                styles.arrowIcon,
                isMenuVisible && styles.arrowIconRotated,
              ]}
            />
          </TouchableOpacity>
        </View>
        {tabLoading ? (
          <View style={[styles.scrollContentContainer, styles.headerChainList]}>
            <SkeletonTabList />
          </View>
        ) : (
          <ScrollView
            style={styles.headerChainList}
            contentContainerStyle={styles.scrollContentContainer}
            horizontal={true}
            showsHorizontalScrollIndicator={false}>
            {chainList.map(chain => (
              <TouchableOpacity
                key={chain?.id}
                onPress={() => handleChainItemPress(chain?.serverId ?? '')}
                style={StyleSheet.flatten([
                  styles.chainItem,
                  selectedChainId === chain?.serverId &&
                    styles.selectedChainItem,
                ])}>
                <ChainIconImage
                  size={18}
                  chainEnum={chain?.enum}
                  isShowRPCStatus={true}
                />
                <Text
                  style={StyleSheet.flatten([
                    styles.chainItemText,
                    selectedChainId === chain?.serverId &&
                      styles.selectedChainItemText,
                  ])}>
                  {chain?.name}
                </Text>
              </TouchableOpacity>
            ))}
            {comingChainList.map(chain => (
              <Tip content={t('page.copyTrading.comingSoon')} key={chain?.id}>
                <View
                  key={chain?.id}
                  style={StyleSheet.flatten([
                    styles.chainItem,
                    styles.chainItemDisabled,
                  ])}>
                  <ChainIconImage
                    size={18}
                    chainEnum={chain?.enum}
                    isShowRPCStatus={true}
                  />
                  <Text style={StyleSheet.flatten([styles.chainItemText])}>
                    {chain?.name}
                  </Text>
                </View>
              </Tip>
            ))}
          </ScrollView>
        )}
      </View>
      {currentUpdateCount > 0 && (
        <View style={styles.updateContainer}>
          <Text style={styles.updateText}>
            {t('page.copyTrading.updateText', { count: currentUpdateCount })}
          </Text>
        </View>
      )}
      <View style={styles.container}>
        {listLoading && !refreshing ? (
          <View style={styles.listContainer}>
            {Array.from({ length: 10 }).map((_, index) => (
              <SkeletonTokenListItem key={index} />
            ))}
          </View>
        ) : (
          <FlatList
            data={tokenList}
            renderItem={({ item }) => (
              <TokenListItem
                showTipsDollarDialog={showTipsDollarDialog}
                item={item}
                onBuyPress={handleBuyPress}
                onPress={handleTokenItemPress}
              />
            )}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderListFooter}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  setHasMore(true);
                  const tokenArr = await fetchTokenList(selectedChainId, 0);
                  checkCountUpdate(tokenArr, tokenList);
                  setTokenList(tokenArr);
                  setRefreshing(false);
                }}
                title={t('page.copyTrading.refreshTitle')}
                titleColor={colors2024['neutral-secondary']}
                tintColor={colors2024['neutral-secondary']}
                progressBackgroundColor={colors2024['neutral-bg-1']}
              />
            }
          />
        )}
      </View>

      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseMenu}>
        <TouchableWithoutFeedback onPress={handleCloseMenu}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuContainer}>
              {filterTabList.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.menuItem,
                    filterRule === item.key && styles.menuItemSelected,
                  ]}
                  onPress={() => handleSelectMenuItem(item.key)}>
                  <Text
                    style={[
                      styles.menuItemText,
                      filterRule === item.key && styles.menuItemTextSelected,
                    ]}>
                    {item.title}
                  </Text>
                  {filterRule === item.key && (
                    <RcIconSelectedCC
                      width={12}
                      color={colors2024['brand-default']}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  headerContainer: {
    position: 'relative',
    marginTop: 44,
    height: 56,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  updateContainer: {
    paddingHorizontal: 16,
    // paddingVertical: 6,
    backgroundColor: colors2024['brand-light-1'],
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  chainItemDisabled: {
    opacity: 0.3,
  },
  chainItem: {
    display: 'flex',
    flexDirection: 'row',
    // alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedChainItem: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors2024['brand-disable'],
  },
  chainItemText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  selectedChainItemText: {
    color: colors2024['brand-default'],
  },
  headerChainList: {
    flexDirection: 'row',
    flex: 0,
    paddingVertical: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    gap: 8,
    // paddingLeft: 16,
    // paddingRight: 16,
  },
  container: {
    flex: 1,
    paddingBottom: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerLoading: {
    paddingVertical: 8,
  },
  noMoreText: {
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    paddingVertical: 16,
  },
  filterContainer: {
    position: 'absolute',
    zIndex: 1,
    right: 0,
    top: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  menuOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    top: 105, // headerContainer height 56 + marginTop 44 + 5 = 105
    right: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 120,
    shadowColor: colors2024['neutral-bg-1'],
    padding: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: 200,
  },
  menuItemSelected: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
    borderWidth: 0.5,
    borderRadius: 6,
  },
  menuItemText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    flex: 1,
  },
  menuItemTextSelected: {
    color: colors2024['brand-default'],
    fontWeight: '500',
  },
  menuItemCheck: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['brand-default'],
    marginLeft: 8,
  },
}));
