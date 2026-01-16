import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components2024/Button';
import { PerpsAccountCard } from './components/PerpsAccountCard';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsAgentsLimitModal } from './components/PerpsAgentsLimitModal';
import { PerpsGuidePopup } from './components/PerpsGuidePopup';
import { PerpsDepositPopup } from './components/PerpsDepositPopup';
import { PerpsWithdrawPopup } from './components/PerpsWithdrawPopup';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import RcIconBackTopCC from '@/assets2024/icons/perps/IconBackTopCC.svg';
import {
  usePerpsPopupState,
  useSelectedToken,
} from './hooks/usePerpsPopupState';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Account } from '@/core/services/preference';
import { PerpsAccountLogoutPopup } from './components/PerpsAccountLogoutPopup';
import { usePerpsDeposit } from './hooks/usePerpsDeposit';
import { PerpsMarketSectionHeader } from './components/PerpsMarketSection';
import { PerpsMarketItem } from './components/PerpsMarketSection/PerpsMarketItem';
import { PerpsPositionSection } from './components/PerpsPositionSection';
import { sortBy } from 'lodash';
import { apisPerps } from '@/core/apis';
import { PerpsAccountSelectorPopup } from './components/PerpsAccountSelectorPopup';
import { PerpsRegionAlert } from './components/PerpsRegionAlert';
import { PerpsSelectTokenPopup } from './components/PerpsDepositPopup/PerpsSelectTokenPopup';
import { PerpsDepositTokenModal } from './components/PerpsDepositPopup/PerpsDepositTokenModal';
import { openapi } from '@/core/request';
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_SERVER_CHAIN,
} from '@/constant/perps';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { PerpHeader } from './components/PerpHeader';
import { PerpSearchListPopup } from './components/PerpSearchListPopup';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { calculateDistanceToLiquidation } from './components/PerpsPositionSection/utils';
import { PerpsRiskLevelPopup } from './components/PerpsPositionSection/PerpsRiskLevelPopup';
import { PerpsSkeletonLoader } from './components/PerpsSkeletonLoader';
import { usePerpsPosition } from '../PerpsMarketDetail/hooks/usePerpsPosition';
import { PerpsInvitePopup } from './components/PerpsInvitePopup';
import { checkPerpsReference } from '@/utils/perps';
import { perpsService } from '@/core/services';
import { toast } from '@/components2024/Toast';

export const PerpsScreen = () => {
  const { t } = useTranslation();

  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const {
    positionAndOpenOrders,
    accountSummary,
    currentPerpsAccount,
    isLogin,
    isInitialized,
    marketData,
    userFills,
    marketDataMap,
    logout,
    login,
    handleWithdraw,
    homeHistoryList,
    handleDeleteAgent,
    hasPermission,
    refreshData,
    fetchMarketData,
    perpFee,

    localLoadingHistory,

    handleActionApproveStatus,
    handleSafeSetReference,
    setInitialized,

    favoriteMarkets,
  } = usePerpsState();
  const { handleClosePosition } = usePerpsPosition();

  // use switchPerpsAccount global function to switch
  // useEffect(() => {
  //   if (_account) {
  //     if (
  //       currentPerpsAccount?.address === _account.address &&
  //       currentPerpsAccount?.type === _account.type
  //     ) {
  //       if (fromName) {
  //         navigation.push(RootNames.StackTransaction, {
  //           screen: RootNames.PerpsMarketDetail,
  //           params: {
  //             market: fromName,
  //           },
  //         });
  //       }
  //     } else {
  //       loginWithNoHardwareSign(_account).then(loginSuccess => {
  //         if (loginSuccess && fromName) {
  //           navigation.push(RootNames.StackTransaction, {
  //             screen: RootNames.PerpsMarketDetail,
  //             params: {
  //               market: fromName,
  //             },
  //           });
  //         }
  //         setInitialized(true);
  //       });
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const [selectedToken, setSelectedToken] = useSelectedToken();
  const [popupState, setPopupState] = usePerpsPopupState();
  const [isShowModal, setIsShowModal] = useState(false);

  // Scroll related states
  const flatListRef = useRef<FlatList>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Prepare sorted market data with header as first item
  const listData = useMemo(() => {
    // Separate favorite and non-favorite markets
    const favoriteItems: typeof marketData = [];
    const nonFavoriteItems: typeof marketData = [];

    marketData.forEach(item => {
      const isFavorite = favoriteMarkets.includes(item.name.toUpperCase());
      if (isFavorite) {
        favoriteItems.push(item);
      } else {
        nonFavoriteItems.push(item);
      }
    });

    // Sort each group by dayNtlVlm (descending)
    const sortedFavorites = sortBy(
      favoriteItems,
      item => -(item.dayNtlVlm || 0),
    );
    const sortedNonFavorites = sortBy(
      nonFavoriteItems,
      item => -(item.dayNtlVlm || 0),
    );

    // Combine: favorites first, then non-favorites
    const sorted = [...sortedFavorites, ...sortedNonFavorites];

    // Add a special header item as first element for sticky header
    return [{ _isStickyHeader: true }, ...sorted];
  }, [marketData, favoriteMarkets]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  const positionCoinSet = useMemo(() => {
    const set = new Set();
    positionAndOpenOrders?.forEach(order => {
      set.add(order.position.coin);
    });
    return set;
  }, [positionAndOpenOrders]);

  const handleLogin = useMemoizedFn(async (v: Account) => {
    // if (currentPerpsAccount?.address) {
    //   logout(currentPerpsAccount?.address || '');
    // }
    await login(v);
    setPopupState(prev => ({
      ...prev,
      isShowLoginPopup: false,
    }));
  });

  const handleLogout = useMemoizedFn(() => {
    try {
      logout(currentPerpsAccount?.address || '');
      setPopupState(prev => ({
        ...prev,
        isShowLogoutPopup: false,
      }));
    } catch (e) {
      console.error(e);
    }
  });

  const { handleDeposit } = usePerpsDeposit({
    currentPerpsAccount,
  });

  const Header = useCallback(
    () =>
      isLogin ? (
        <PerpHeader localLoadingHistory={localLoadingHistory} />
      ) : undefined,
    [isLogin, localLoadingHistory],
  );
  const Title = useCallback(
    () => <PerpsHeaderTitle account={currentPerpsAccount} />,
    [currentPerpsAccount],
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: Title,
      headerRight: Header,
    });
  }, [currentPerpsAccount, navigation, Header, Title]);

  useEffect(() => {
    apisPerps.getHasDoneNewUserProcess().then(hasDoneNewUserProcess => {
      if (!hasDoneNewUserProcess) {
        setPopupState(prev => ({
          ...prev,
          isShowGuidePopup: true,
        }));
      }
    });
  }, [setPopupState]);

  const onRefresh = useMemoizedFn(() => {
    if (isLogin) {
      refreshData();
    }
    fetchMarketData(false);
  });

  // Handle scroll event
  const handleScroll = useMemoizedFn((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;

    // Show back to top button when scrolling down 200px
    const shouldShow = scrollY > 200;
    if (shouldShow !== showBackToTop) {
      setShowBackToTop(shouldShow);
    }
  });

  // Scroll to top
  const scrollToTop = useMemoizedFn(() => {
    setShowBackToTop(false);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  });

  const handleShowRiskPopup = useMemoizedFn((coin: string) => {
    setSelectedCoin(coin);
  });

  const handleCloseRiskPopup = useMemoizedFn(() => {
    setSelectedCoin(null);
  });

  const { data: isShowInvite, mutate: setIsShowInvite } = useRequest(
    async () => {
      return checkPerpsReference({
        account: currentPerpsAccount,
        scene: 'invite',
      });
    },
    {
      refreshDeps: [currentPerpsAccount],
      ready: !!currentPerpsAccount?.address,
      onSuccess: shouldShow => {
        if (shouldShow) {
          perpsService.setInviteConfig(currentPerpsAccount?.address || '', {
            lastInvitedAt: Date.now(),
          });
        }
      },
    },
  );

  // Calculate real-time popup data based on selectedCoin
  const riskPopupData = useMemo(() => {
    if (!selectedCoin) {
      return null;
    }

    const selectedPosition = positionAndOpenOrders?.find(
      item => item.position.coin === selectedCoin,
    );
    if (!selectedPosition) {
      return null;
    }

    const marketDataItem = marketDataMap[selectedCoin];
    const markPrice = Number(marketDataItem?.markPx || 0);
    const liquidationPrice = Number(
      selectedPosition.position.liquidationPx || 0,
    );

    const distanceLiquidation = calculateDistanceToLiquidation(
      selectedPosition.position.liquidationPx,
      marketDataItem?.markPx,
    );
    return {
      distanceLiquidation,
      direction:
        Number(selectedPosition.position.szi || 0) > 0
          ? 'Long'
          : ('Short' as 'Long' | 'Short'),
      currentPrice: markPrice,
      pxDecimals: marketDataItem?.pxDecimals || 2,
      liquidationPrice,
    };
  }, [selectedCoin, positionAndOpenOrders, marketDataMap]);

  // Render header component (account card and positions)
  const renderListHeader = useCallback(() => {
    return (
      <>
        <PerpsAccountCard
          isLogin={isLogin}
          accountSummary={accountSummary}
          positionAndOpenOrders={positionAndOpenOrders}
        />
        <PerpsPositionSection
          handleShowRiskPopup={handleShowRiskPopup}
          handleCloseRiskPopup={handleCloseRiskPopup}
          positionAndOpenOrders={positionAndOpenOrders}
          handleActionApproveStatus={handleActionApproveStatus}
          marketDataMap={marketDataMap}
          onClosePosition={async position => {
            const marketDataItem = marketDataMap[position.coin];
            await handleClosePosition({
              coin: position.coin,
              size: Math.abs(Number(position.szi || 0)).toString() || '0',
              direction: Number(position.szi || 0) > 0 ? 'Long' : 'Short',
              price: marketDataItem?.markPx || '0',
            });
          }}
        />
      </>
    );
  }, [
    isLogin,
    accountSummary,
    positionAndOpenOrders,
    marketDataMap,
    handleClosePosition,
    handleShowRiskPopup,
    handleCloseRiskPopup,
    handleActionApproveStatus,
  ]);

  // Render item - either sticky header or market item
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      // First item is the sticky market section header
      if (item._isStickyHeader) {
        return <PerpsMarketSectionHeader />;
      }

      // Rest are market items
      return (
        <PerpsMarketItem
          item={item}
          isFavorite={favoriteMarkets.includes(item.name.toUpperCase())}
          hasPosition={positionCoinSet.has(item.name)}
          onPress={() => {
            scrollToTop();
            naviPush(RootNames.StackTransaction, {
              screen: RootNames.PerpsMarketDetail,
              params: {
                market: item.name,
                fromSource: 'openPosition',
                showOpenPosition: true,
              },
            });
          }}
        />
      );
    },
    [positionCoinSet, scrollToTop, favoriteMarkets],
  );

  const keyExtractor = useCallback(
    (item: any) => (item._isStickyHeader ? 'sticky-header' : item.name),
    [],
  );

  const ItemSeparator = useCallback(
    ({ leadingItem }: any) => {
      // No separator after sticky header
      if (leadingItem?._isStickyHeader) {
        return null;
      }
      return <View style={styles.itemSeparator} />;
    },
    [styles],
  );

  return (
    <>
      <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
        {!hasPermission ? <PerpsRegionAlert /> : null}
        {!isInitialized ? (
          <PerpsSkeletonLoader />
        ) : (
          <View style={styles.screenContainer}>
            <FlatList
              ref={flatListRef}
              data={listData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              ListHeaderComponent={renderListHeader}
              ItemSeparatorComponent={ItemSeparator}
              style={styles.container}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={onRefresh} />
              }
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              initialNumToRender={10}
              windowSize={5}
              onEndReachedThreshold={0.5}
            />

            {/* Back to Top Button */}
            {showBackToTop && (
              <TouchableOpacity
                style={styles.backToTopButton}
                onPress={scrollToTop}>
                <RcIconBackTopCC color={colors2024['neutral-body']} />
              </TouchableOpacity>
            )}
            {hasPermission && isLogin && (
              <View style={styles.footer}>
                <Button
                  type="primary"
                  title={t('page.perps.searchPerpsPopup.openPosition')}
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowSearchListPopup: true,
                      searchListOpenFrom: 'openPosition',
                    }));
                  }}
                />
              </View>
            )}
          </View>
        )}
      </NormalScreenContainer2024>
      <PerpsAccountSelectorPopup
        visible={popupState.isShowLoginPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLoginPopup: false,
          }));
        }}
        value={currentPerpsAccount}
        onChange={handleLogin}
        title={t('page.perps.selectAccountTitle')}
      />
      <PerpsAccountLogoutPopup
        visible={popupState.isShowLogoutPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLogoutPopup: false,
          }));
        }}
        onLogout={handleLogout}
        account={currentPerpsAccount}
      />
      <PerpsAgentsLimitModal
        visible={popupState.isShowDeleteAgentPopup}
        onCancel={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
        onConfirm={() => {
          handleDeleteAgent();
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
      />
      <PerpsGuidePopup
        visible={popupState.isShowGuidePopup}
        onClose={async () => {
          const hasDoneNewUserProcess =
            await apisPerps.getHasDoneNewUserProcess();
          if (!hasDoneNewUserProcess) {
            navigation.goBack();
          }
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
        onComplete={() => {
          apisPerps.setHasDoneNewUserProcess(true);
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
      />
      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={popupState.isShowDepositPopup}
        accountSummary={accountSummary}
        showSelectTokenPopup={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositTokenPopup: true,
          }));
        }}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: false,
          }));
        }}
        onDeposit={async (txs, amount, cacheBridgeHistory) => {
          try {
            await handleDeposit(txs, amount, cacheBridgeHistory);
          } catch (e) {
            console.error(e);
          }
          // await sleep(5000);
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: false,
          }));
        }}
      />
      <PerpsSelectTokenPopup
        account={currentPerpsAccount}
        visible={popupState.isShowDepositTokenPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositTokenPopup: false,
          }));
        }}
        onSelect={async token => {
          setSelectedToken(token);
          if (
            token.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
            isSameAddress(token.id, ARB_USDC_TOKEN_ID)
          ) {
            setPopupState(prev => ({
              ...prev,
              isShowDepositTokenPopup: false,
              isShowDepositPopup: true,
            }));
            return;
          }

          const res = await openapi.getPerpsBridgeIsSupportToken({
            token_id: token.id,
            chain_id: token.chain,
          });

          if (res?.success) {
            // bridge token with liFi dex
            setPopupState(prev => ({
              ...prev,
              isShowDepositTokenPopup: false,
              isShowDepositPopup: true,
            }));
            // setClickLoading(false);
          } else {
            setIsShowModal(true);
          }
        }}
      />
      <PerpsDepositTokenModal
        visible={isShowModal}
        onCancel={() => {
          setIsShowModal(false);
        }}
        token={selectedToken}
        onNavigate={() => {
          setIsShowModal(false);
          setPopupState(prev => ({
            ...prev,
            isShowDepositTokenPopup: false,
            isShowDepositPopup: false,
          }));
        }}
      />
      <PerpsWithdrawPopup
        visible={popupState.isShowWithdrawPopup}
        accountSummary={accountSummary}
        onWithdraw={async v => {
          await handleWithdraw(v);
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
      />
      <PerpSearchListPopup
        visible={popupState.isShowSearchListPopup}
        openFromSource={popupState.searchListOpenFrom}
        onSelect={name => {
          scrollToTop();
          naviPush(RootNames.StackTransaction, {
            screen: RootNames.PerpsMarketDetail,
            params: {
              market: name,
              fromSource: 'openPosition',
              showOpenPosition: true,
            },
          });
        }}
        onCancel={() => {
          setPopupState(prev => ({
            ...prev,
            isShowSearchListPopup: false,
          }));
        }}
        marketData={marketData}
        positionAndOpenOrders={positionAndOpenOrders}
      />
      {/* Shared Risk Level Popup */}
      {riskPopupData && (
        <PerpsRiskLevelPopup
          direction={riskPopupData.direction}
          visible={!!riskPopupData}
          pxDecimals={riskPopupData?.pxDecimals || 2}
          onClose={handleCloseRiskPopup}
          distanceLiquidation={riskPopupData.distanceLiquidation}
          currentPrice={riskPopupData.currentPrice}
          liquidationPrice={riskPopupData.liquidationPrice}
        />
      )}
      <PerpsInvitePopup
        visible={isShowInvite}
        onClose={() => setIsShowInvite(false)}
        onInvite={async () => {
          await handleActionApproveStatus({
            isHideToast: true,
          });
          await handleSafeSetReference();
          setIsShowInvite(false);
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
  },
  screenContainer: {
    position: 'relative',
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    // paddingBottom: 10,
  },
  footer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  backToTopButton: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  itemSeparator: {
    height: 8,
  },
  listFooter: {
    height: 56,
  },
}));
