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
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import {
  CopyTradeTokenItem,
  CopyTradeTokenItemV2,
} from '@rabby-wallet/rabby-api/dist/types';
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
import {
  FilterDropdownMenu,
  FilterRuleEnum,
  FilterTabItem,
} from './component/FilterDropdownMenu';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { Skeleton } from '@rneui/themed';
import { Tip } from '@/components';
import RcIconSelectedCC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-community/blur';
import { BlurShadowView } from '@/components2024/BluerShadow';
import {
  formatUsdValueKMB,
  formatUsdValueKMBWithSign,
} from '../Home/utils/price';
import { useProfit } from './component/useProfit';
import { TabType } from './component/CopyTradingTokenDetail';
const DEFAULT_COUNT = 10;

const DEFAULT_COMING_CHAIN_ID = ['base', 'eth', 'bsc', 'avax'];

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
  const [tokenList, setTokenList] = useState<CopyTradeTokenItemV2[]>([]);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const [filterRule, setFilterRule] = useState<FilterRuleEnum>(
    FilterRuleEnum['24hPrice'],
  );
  const { navigation } = useSafeSetNavigationOptions();
  const [tabLoading, setTabLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUpdateCount, setCurrentUpdateCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [listCursor, setListCursor] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Floating bar animation
  const floatingBarOpacity = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);

  const filterTabList: FilterTabItem[] = useMemo(() => {
    return [
      {
        key: FilterRuleEnum['24hPrice'],
        title: t('page.copyTrading.filterRule.24HChange'),
        orderKey: 'price_change',
        rule: '24H Change',
      },
      {
        key: FilterRuleEnum.smartMoney,
        title: t('page.copyTrading.filterRule.smartMoney'),
        orderKey: 'buy_address_count',
        rule: 'Amount',
      },
      {
        key: FilterRuleEnum.tokenCreate,
        title: t('page.copyTrading.filterRule.tokenCreate'),
        orderKey: 'token_create_at',
        rule: 'Time',
      },
    ];
  }, [t]);

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
      return chainIdArr;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return [];
    } finally {
      setTabLoading(false);
    }
  });

  const fetchTokenList = useMemoizedFn(
    async (
      chainId: string,
      orderBy: FilterTabItem['orderKey'],
      cursor: string,
      isLoadMore = false,
    ) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setListLoading(true);
        }

        const { token_list, pagination } =
          await openapi.getCopyTradingTokenListV2({
            chain_id: chainId,
            limit: DEFAULT_COUNT,
            cursor,
            order_by: orderBy,
            order: 'desc',
          });
        setHasMore(pagination.has_next);
        setListCursor(pagination.next_cursor);

        if (isLoadMore) {
          setTokenList(prev => {
            const existingIds = new Set(prev.map(token => token.id));
            const newTokens = token_list.filter(
              token => !existingIds.has(token.id),
            );
            return [...prev, ...newTokens];
          });
        } else {
          setTokenList(token_list);
        }

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

  const orderKey = useMemo(() => {
    const selectedRuleItem = filterTabList.find(
      item => item.key === filterRule,
    );
    return selectedRuleItem?.orderKey ?? 'price_change';
  }, [filterRule, filterTabList]);

  const handleSelectMenuItem = useMemoizedFn((selectedRule: FilterRuleEnum) => {
    if (filterRule !== selectedRule) {
      setFilterRule(selectedRule);
      // switch filter rule and refetch data
      if (selectedChainId) {
        setHasMore(true);
        const selectedRuleItem = filterTabList.find(
          item => item.key === selectedRule,
        );
        fetchTokenList(
          selectedChainId,
          selectedRuleItem?.orderKey ?? 'price_change',
          '',
        );
      }
    }
    handleCloseMenu();
  });

  const initFetchData = useMemoizedFn(async () => {
    setTabLoading(true);
    setListLoading(true);
    setHasMore(true);
    setListCursor('');
    const chainIdArr = await fetchChainList();

    setChainIdList(chainIdArr);
    setSelectedChainId(chainIdArr[0]);
    await fetchTokenList(chainIdArr[0], 'price_change', '');
  });

  const handleChainItemPress = useMemoizedFn(async (chainId: string) => {
    if (chainId === selectedChainId) {
      return;
    }
    setSelectedChainId(chainId);
    setHasMore(true);
    setListCursor('');
    const tokenArr = await fetchTokenList(chainId, 'price_change', '');
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
        isFromCopyTrading: true,
      },
    });
  });

  const handleTokenItemPress = useMemoizedFn(
    (item: CopyTradeTokenItemV2, isShowSmartWallets = false) => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.COPY_TRADING_TOKEN_DETAIL,
        tradingTokenItem: item,
        showTabType: isShowSmartWallets
          ? TabType.smartWallets
          : TabType.tokenInfo,
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      });
    },
  );

  const handleShowEarningDialog = useMemoizedFn(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.COPY_TRADING_EARNINGS,
      itemData: profitData?.itemData,
      totalProfit: profitData?.totalProfit,
      totalHoldValue: profitData?.totalHoldValue,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  });

  const { showTipsDollarDialog } = useTipsDollarDialog();

  // Handle scroll for floating bar animation
  const handleScroll = useMemoizedFn(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const deltaY = currentScrollY - lastScrollY.current;

      // Show/hide floating bar based on scroll direction
      if (deltaY > 5) {
        // Scrolling down - hide the bar
        Animated.timing(floatingBarOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (deltaY < -5) {
        // Scrolling up - show the bar
        Animated.timing(floatingBarOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }

      lastScrollY.current = currentScrollY;
    },
  );

  // fetch more data
  const handleLoadMore = useMemoizedFn(async () => {
    if (loadingMore || !hasMore || tokenList.length === 0) {
      return;
    }

    await fetchTokenList(selectedChainId, orderKey, listCursor, true);
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

  const { profitData, showProfitBar } = useProfit();

  return (
    <NormalScreenContainer type="bg1" noHeader={true}>
      <View style={styles.headerContainer}>
        <FilterDropdownMenu
          isVisible={isMenuVisible}
          selectedRule={filterRule}
          filterTabList={filterTabList}
          onOpen={handleOpenMenu}
          onClose={handleCloseMenu}
          onSelectItem={handleSelectMenuItem}
        />
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
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
                  setListCursor('');
                  const tokenArr = await fetchTokenList(
                    selectedChainId,
                    orderKey,
                    '',
                  );
                  checkCountUpdate(tokenArr, tokenList);
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

      {showProfitBar && (
        <Animated.View style={{ opacity: floatingBarOpacity }}>
          <View style={styles.floatingBar}>
            <LinearGradient
              colors={
                isLight
                  ? ['rgba(246, 247, 247, 0.00)', '#F6F7F7']
                  : ['rgba(19, 20, 22, 0.00)', '#131416']
              }
              locations={[0, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              angle={180}
              style={styles.gradientOverlay}>
              <TouchableOpacity
                style={styles.floatingBarButtonWrapper}
                onPress={handleShowEarningDialog}>
                <BlurShadowView isLight={isLight} blurAmount={10}>
                  <LinearGradient
                    colors={
                      isLight
                        ? [
                            'rgba(255, 255, 255, 0.80)',
                            'rgba(255, 255, 255, 0.40)',
                          ]
                        : ['rgba(35, 36, 40, 0.80)', 'rgba(35, 36, 40, 0.40)']
                    }
                    // locations={[0.009, 0.9864]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    angle={81}
                    style={styles.floatingBarButton}>
                    <View style={styles.floatingBarContent}>
                      <Text style={styles.floatingBarText}>
                        {t('page.copyTrading.myCopyTrading')} :{' '}
                      </Text>
                      <Text style={styles.floatingBarBalanceText}>
                        {formatUsdValueKMB(profitData?.totalHoldValue || 0)}
                      </Text>
                      <Text
                        style={StyleSheet.flatten([
                          styles.floatingBarBalanceText,
                          profitData?.totalProfit && profitData?.totalProfit > 0
                            ? styles.floatingBarProfitText
                            : styles.floatingBarLossText,
                        ])}>
                        {`(${formatUsdValueKMBWithSign(
                          profitData?.totalProfit || 0,
                        )})`}
                      </Text>
                    </View>
                    <RcIconSelectedCC
                      width={16}
                      height={16}
                      color={colors2024['neutral-foot']}
                    />
                  </LinearGradient>
                </BlurShadowView>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Animated.View>
      )}
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
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 123,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -27,
    },
    shadowOpacity: 0.06,
    shadowRadius: 27.5,
    elevation: 27,
  },
  floatingBarButtonWrapper: {
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  floatingBarButton: {
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  floatingBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  floatingBarIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors2024['brand-light-1'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBarIconText: {
    fontSize: 18,
    fontWeight: '500',
  },
  floatingBarText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  floatingBarBalanceText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  floatingBarProfitText: {
    color: colors2024['green-default'],
  },
  floatingBarLossText: {
    color: colors2024['red-default'],
  },
  floatingBarArrow: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '400',
  },
  blurContainer: {
    flex: 1,
  },
  gradientOverlay: {
    flex: 1,
  },
}));
