import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Easing,
  RefreshControl,
  ScrollView,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import { useTheme2024, useAppThemeConfig } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import RcIconSend from '@/assets2024/icons/home/IconSend.svg';
import RcIconReceive from '@/assets2024/icons/home/IconReceive.svg';
import RcIconSwap from '@/assets2024/icons/home/IconSwap.svg';
import RcIconBridge from '@/assets2024/icons/home/IconBridge.svg';
import RcIconHistory from '@/assets2024/icons/home/IconHistory.svg';
import RcIconloading from '@/assets2024/icons/home/Iconloading.svg';
import RcIconGasAccount from '@/assets2024/icons/home/IconGasAccount.svg';
import RcIconApprovals from '@/assets2024/icons/home/IconApprovals.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDapps.svg';
import RcIconWatchlist from '@/assets2024/icons/home/IconWatchlist.svg';

import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import {
  browserService,
  gasAccountService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { useMemoizedFn } from 'ahooks';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { matomoRequestEvent } from '@/utils/analytics';
import { apisAccount } from '@/core/apis';
import { resetNavigationTo } from '@/hooks/navigation';
import { navigate } from '@/utils/navigation';
import { useApprovalAlertCounts } from './hooks/approvals';
import { BadgeText } from './components/HomeTopArea';
import { useMyAccounts } from '@/hooks/account';
import { ThemeColors2024 } from '@/constant/theme';
import { useAppState } from '@react-native-community/hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncAssetsDB } from '@/databases/hooks/assets';
import { useSortAddressList } from '../Address/useSortAddressList';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { debounce, unionBy } from 'lodash';
import { useUpgradeInfo } from '@/hooks/version';

import RcIconBuy from '@/assets2024/icons/home/IconBuy.svg';
import RcIconCopyTrading from '@/assets2024/icons/home/IconCopyTrading.svg';
import { FoundYourWalletGuide } from './FundYourWallet';
import {
  OfflineChainNotify,
  useOfflineChain,
} from './components/OfflineChainNotify';
import { colord } from 'colord';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useFetchCexInfo } from '@/hooks/useAddrDesc';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { Card } from '@/components2024/Card';
import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import LinearGradient from 'react-native-linear-gradient';
import { LoadingLinear } from '../TokenDetail/components/TokenPriceChart/LoadingLinear';
import { Skeleton } from '@rneui/base';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { BlurShadowView } from '@/components2024/BluerShadow';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { judgeIsSmallUsdTx } from '../Transaction/components/utils';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { HomePendingBadge } from './components/HomePending';
import { useTipsDollarDialog } from '../CopyTrading/component/hooks';
import { RateModalTriggerOnHome } from '@/components/RateModal/RateModalTriggerOnHome';
import { useExposureRateGuide } from '@/components/RateModal/hooks';
import { RateModal } from '@/components/RateModal/RateModal';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { useInitDetectDBAssets } from '../Search/useAssets';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { BrowserSearchEntry } from '../Browser/components/BrowserSearchEntry';
import dayjs from 'dayjs';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

const HeaderHeight = 24;

function MultiAddressHomeHeader(
  prop: {
    data: ReturnType<typeof useMultiCurve>['combineData'];
    loading: boolean;
    loadingNewCurve: boolean;
    onRefresh?: () => void;
  } & RNViewProps,
): JSX.Element {
  const { loading, data, loadingNewCurve, style, onRefresh } = prop;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;
  const { remoteVersion } = useUpgradeInfo();
  const { isDisConnnect } = useGlobalStatus();

  const { accountsLength } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const percentChange = useMemo(() => {
    return `${data.isLoss ? '-' : '+'}${data.changePercent}(${
      data.isLoss ? '-' : '+'
    }${data.change})`;
  }, [data]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.resetAnimation();
    }
  }, [loading, spinValue]);

  return (
    <View style={style}>
      <View style={styles.headerBox}>
        <View style={styles.leftBox}>
          <Text style={styles.balanceTextBox}>
            {t('page.nextComponent.multiAddressHome.totalBalance')}
          </Text>
          <Animated.View
            style={{
              transform: [{ rotate: spin }],
            }}>
            {loading && <RcIconloading />}
          </Animated.View>
        </View>
        <TouchableWithoutFeedback
          style={styles.settingEntry}
          onPress={() => {
            navigation.navigate(RootNames.StackSettings, {
              screen: RootNames.Settings,
              params: {},
            });

            matomoRequestEvent({
              category: 'Click_Header',
              action: 'Click_Setting',
            });
          }}>
          <RcIconSetting color={colors2024['neutral-title-1']} />
          {remoteVersion.couldUpgrade && <View style={styles.redDot} />}
        </TouchableWithoutFeedback>
      </View>

      <GlobalWarning
        hasError={isDisConnnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => {
          onRefresh?.();
        }}
      />

      <View style={styles.curveBox}>
        <BlurShadowView isLight={isLight}>
          <LinearGradient
            colors={
              isLight
                ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)']
                : ['rgba(37,38,40,1)', 'rgba(28,27,27,1)']
            }
            style={{
              padding: 1,
              borderRadius: 21,
            }}>
            <Card
              style={[styles.curveCard, styles.shadowView]}
              onPress={() => {
                navigation.dispatch(
                  StackActions.push(RootNames.StackAddress, {
                    screen: RootNames.AddressAssetsOverview,
                    params: {},
                  }),
                );
                matomoRequestEvent({
                  category: 'Click_Header',
                  action: 'Click_Address',
                });
              }}>
              <LinearGradient
                colors={
                  isLight
                    ? ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)']
                    : ['rgba(0, 0, 0, 0.6)', 'rgba(25, 26, 27, 0.3)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.curveContainer}>
                {loadingNewCurve ? (
                  <Skeleton
                    width={181}
                    height={44}
                    style={styles.skeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : (
                  <Text style={styles.netWorth}>{data.netWorth}</Text>
                )}
                {loadingNewCurve ? (
                  <Skeleton
                    width={100}
                    height={22}
                    style={styles.skeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : (
                  <View style={styles.changeSection}>
                    <Text
                      style={[
                        styles.changePercent,
                        {
                          color: data.isLoss
                            ? colors2024['red-default']
                            : colors2024['green-default'],
                        },
                      ]}>
                      {percentChange}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.accountBg}>
                <RcIconSmallWallet />
                <Text style={styles.accountText}>
                  {accountsLength >= 10 ? '10' : accountsLength}
                </Text>
                <RcIconSmallArrow />
              </View>
            </Card>
          </LinearGradient>
        </BlurShadowView>
      </View>
    </View>
  );
}

const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
const ITEM_GRID_GAP = 12;
const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;

function MultiAddressHome(): JSX.Element {
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const appThemeConfig = useAppThemeConfig();
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [historyCount, setHistoryCount] = useState<{
    success: number;
    fail: number;
  }>();
  const { top10Addresses } = useAccountInfo();

  // 添加gift资格检查hook
  const { checkAddressesEligibility, getCurrentEligibleAddress } =
    useGasAccountEligibility();
  const currentEligibleAddress = getCurrentEligibleAddress();
  const timeRef = useRef<null | NodeJS.Timer>(null);
  const appState = useAppState();
  const gasAccountSig = gasAccountService.getGasAccountSig();
  const hasClaimedGift = gasAccountService.getHasClaimedGift();
  const { width } = Dimensions.get('window');
  const itemWidth =
    (width - ITEM_LAYOUT_PADDING_HORIZONTAL * 2 - ITEM_GRID_GAP - 2) / 2;
  // 使用useMemo直接计算isEligible，使其能够响应相关状态变化
  const isEligible = useMemo(() => {
    return (
      currentEligibleAddress !== undefined &&
      !gasAccountSig?.sig &&
      !hasClaimedGift
    );
  }, [currentEligibleAddress, gasAccountSig, hasClaimedGift]);

  const spinValue = useRef(new Animated.Value(0)).current;
  const {
    alertInfo,
    forceUpdate,
    triggerUpdate: triggerUpdateAlert,
  } = useApprovalAlertCounts(HOME_REFRESH_INTERVAL);
  const MENU_ARR = useMemo(
    () =>
      [
        {
          key: MultiHomeFeatTitle.Swap,
          title: t('page.home.services.swap'),
          icon: RcIconSwap,
        },
        {
          key: MultiHomeFeatTitle.Send,
          title: t('page.home.services.send'),
          icon: RcIconSend,
        },
        {
          key: MultiHomeFeatTitle.Receive,
          title: t('page.home.services.receive'),
          icon: RcIconReceive,
        },
        {
          key: MultiHomeFeatTitle.Bridge,
          title: t('page.home.services.bridge'),
          icon: RcIconBridge,
        },
        {
          key: MultiHomeFeatTitle.CopyTrading,
          title: t('page.home.services.copyTrading'),
          icon: RcIconCopyTrading,
        },
        {
          key: MultiHomeFeatTitle.History,
          title: t('page.home.services.history'),
          icon: RcIconHistory,
          badge: historyCount?.fail || historyCount?.success,
          isSuccess: !historyCount?.fail,
        },
        {
          key: MultiHomeFeatTitle.Approvals,
          title: t('page.home.services.approvals'),
          icon: RcIconApprovals,
          badge: alertInfo.total,
        },
        {
          key: MultiHomeFeatTitle.GasAccount,
          title: t('page.home.services.gasAccount'),
          icon: RcIconGasAccount,
          showGiftIcon: isEligible,
        },
        // __DEV__ && {
        //   title: MultiHomeFeatTitle.TEST_DAPP,
        //   icon: RcIconDapps,
        // },
        // {
        //   key: MultiHomeFeatTitle.Dapps,
        //   title: IS_IOS
        //     ? t('page.home.services.websites')
        //     : t('page.home.services.dapps'),
        //   icon: RcIconDapps,
        // },
        {
          key: MultiHomeFeatTitle.Watchlist,
          title: t('page.home.services.watchlist'),
          icon: RcIconWatchlist,
        },
        // {
        //   title: MultiHomeFeatTitle.Ecosystem,
        //   icon: RcIconEcosystem,
        // },
        // {
        //   title: MultiHomeFeatTitle.Points,
        //   icon: RcIconPoints,
        // },
      ].filter(Boolean) as {
        key: MultiHomeFeatTitle;
        title: string;
        icon: React.FC<import('react-native-svg').SvgProps>;
        badge?: number;
        isSuccess?: boolean;
        showGiftIcon?: boolean;
      }[],
    [alertInfo.total, t, historyCount, isEligible],
  );

  useEffect(() => {
    if (pendingTxCount) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.resetAnimation();
    }
  }, [pendingTxCount, spinValue]);

  const {
    balanceAccounts,
    balanceCacheAccounts,
    triggerUpdate,
    getTotalBalance,
  } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const {
    combineData,
    refresh: refreshCurve,
    loading,
    isLoadingNew: loadingNewCurve,
  } = useMultiCurve(
    top10Addresses,
    true,
    top10Balance.total,
    top10Balance.totalEvm,
  );
  useCexSupportList();
  useFetchCexInfo();
  useInitDetectDBAssets();

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);

  // 获取top50的私钥助记词账户
  const top50PrivateKeyAccounts = useMemo(() => {
    return sortedAccounts
      .filter(account => account.type == KEYRING_TYPE.SimpleKeyring)
      .slice(0, 50)
      .map(account => account.address);
  }, [sortedAccounts]);

  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);
  const [hasOpenCopyTrading, setHasOpenCopyTrading] = useState(true);

  // 初始化gift资格检查
  useFocusEffect(
    React.useCallback(() => {
      if (top50PrivateKeyAccounts.length > 0) {
        checkAddressesEligibility(top50PrivateKeyAccounts, true);
      }
    }, [top50PrivateKeyAccounts, checkAddressesEligibility]),
  );

  const { syncTop10Assets } = useSyncAssetsDB(unionAccounts);
  const { syncTop10History } = useSyncHistoryDB(top10Addresses);

  const displayFundWallet = useMemo(
    () =>
      !!balanceAccounts.length &&
      balanceAccounts.every(e => e.balance === 0) &&
      balanceCacheAccounts.every(e => e.balance === 0) &&
      balanceAccounts.every(
        e =>
          transactionHistoryService.getTransactionGroups({ address: e.address })
            .length === 0,
      ),
    [balanceAccounts, balanceCacheAccounts],
  );

  const fetchHistory = useCallback(() => {
    const addresses = balanceCacheAccounts.map(i => i.address);
    if (!addresses.length) {
      return;
    }
    const { pendingsLength } =
      transactionHistoryService.getPendingsAddresses(addresses);
    setPendingTxCount(pendingsLength);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength ? setInterval(fetchHistory, 5000) : null;
  }, [balanceCacheAccounts, setPendingTxCount]);

  const detectHasAccounts = useMemoizedFn(async () => {
    const result = { redirectAction: null as Function | null };
    const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();

    if (!hasAccountsInKeyring) {
      result.redirectAction = () => {
        resetNavigationTo(navigation, 'GetStarted2024');
      };
    }

    return result;
  });

  useEffect(() => {
    setTimeout(() => {
      deleteLongTimeCurveCache();
    }, 0);
  }, []);

  // useMount(() => {  no use ?
  //   eventBus.addListener(EVENTS.TX_COMPLETED, fetchHistory);
  //   return () => {
  //     eventBus.removeListener(EVENTS.TX_COMPLETED, fetchHistory);
  //   };
  // });

  const getSuccessAndFailList = useCallback(async () => {
    const timestamp = transactionHistoryService.getClearSuccessAndFailListTs();
    const clearSuccessAndFailListTsObj =
      transactionHistoryService.getClearSuccessAndFailListTsObj();
    const list = await HistoryItemEntity.getAllHistoryItemSortedByTime(
      top10Addresses,
      200,
      true,
      timestamp / 1000,
    );
    list.map(i => {
      const status = i.status ?? 1;
      const id = `${i.owner_addr.toLowerCase()}-${i.txHash}`;
      const addressTs =
        clearSuccessAndFailListTsObj[i.owner_addr.toLowerCase()] ?? 0;
      if (addressTs && addressTs / 1000 > i.time_at) {
        return;
      }
      if (status === 1) {
        transactionHistoryService.setSucceedList(id);
      } else {
        transactionHistoryService.setFailedList(id);
      }
    });

    const count = transactionHistoryService.getFailedCount();
    const success = transactionHistoryService.getSucceedCount();

    setHistoryCount({
      success: success,
      fail: count,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { redirectAction } = await detectHasAccounts();
        if (redirectAction) {
          redirectAction();
        } else {
          fetchHistory();
        }
      })();
    }, [detectHasAccounts, fetchHistory]),
  );

  useFocusEffect(
    useCallback(() => {
      getSuccessAndFailList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSuccessAndFailList, pendingTxCount]),
  );

  useFocusEffect(
    useCallback(() => {
      const value = preferenceService.getHasOpenCopyTrading();
      setHasOpenCopyTrading(value ?? true);
    }, [setHasOpenCopyTrading]),
  );

  const thorttleGetSuccessAndFailList = useMemo(
    () => debounce(getSuccessAndFailList, 1000),
    [getSuccessAndFailList],
  );

  useAppOrmSyncEvents({
    taskFor: ['all-history'],
    onRemoteDataUpserted: ctx => {
      switch (ctx.taskFor) {
        case 'all-history':
          thorttleGetSuccessAndFailList();
          break;
        default:
          break;
      }
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (appState === 'active') {
        triggerUpdate();
        triggerUpdateAlert();
        syncTop10Assets();
        syncTop10History();
        refreshCurve();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      triggerUpdate,
      triggerUpdateAlert,
      appState,
      getSuccessAndFailList,
      checkAddressesEligibility,
    ]),
  );

  const onRefresh = useCallback(() => {
    Promise.all([
      triggerUpdate(true), // force update balance from server api
      refreshCurve(true),
      checkAddressesEligibility(top50PrivateKeyAccounts, true),
    ]).finally(() => {
      // update at background
      forceUpdate();
      syncTop10Assets(true);
      syncTop10History(true);
    });
  }, [
    triggerUpdate,
    refreshCurve,
    forceUpdate,
    syncTop10Assets,
    syncTop10History,
    checkAddressesEligibility,
    top50PrivateKeyAccounts,
  ]);

  const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
  const { navigateToSendPolyScreen } = useSendRoutes();
  const handlePressWatchlist = useCallback(() => {
    navigation.navigate(RootNames.StackHomeNonTab, {
      screen: RootNames.Watchlist,
      params: {},
    });
  }, [navigation]);

  const handleClickMenu = useCallback(
    (key: MultiHomeFeatTitle) => {
      switch (key) {
        case MultiHomeFeatTitle.Send:
          navigateToSendPolyScreen(false);
          break;
        case MultiHomeFeatTitle.Receive:
          navigation.dispatch(
            StackActions.push(RootNames.StackAddress, {
              screen: RootNames.ReceiveAddressList,
              params: {},
            }),
          );

          break;
        case MultiHomeFeatTitle.Swap:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiSwap,
              params: {},
            }),
          );

          break;
        case MultiHomeFeatTitle.Bridge:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiBridge,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.History:
          toggleUseAllAccountsOnScene('MultiHistory', true);
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiAddressHistory,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Approvals:
          navigate(RootNames.StackAddress, {
            screen: RootNames.ApprovalAddressList,
          });
          break;
        case MultiHomeFeatTitle.GasAccount:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.GasAccount,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Watchlist: {
          handlePressWatchlist();
          break;
        }
        case MultiHomeFeatTitle.Ecosystem:
          break;
        case MultiHomeFeatTitle.Buy:
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.MultiBuy,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.CopyTrading:
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.CopyTrading,
            params: {},
          });
          break;
        default:
          break;
      }
    },
    [
      handlePressWatchlist,
      navigateToSendPolyScreen,
      navigation,
      toggleUseAllAccountsOnScene,
    ],
  );

  const { showTipsDollarDialog } = useTipsDollarDialog();
  const generateCustomBadgeIcon = useCallback(
    (el: {
      key: MultiHomeFeatTitle;
      title: string;
      icon: React.FC<import('react-native-svg').SvgProps>;
      badge?: number;
      isSuccess?: boolean;
      showGiftIcon?: boolean;
    }) => {
      if (el.key === MultiHomeFeatTitle.CopyTrading && !hasOpenCopyTrading) {
        return (
          <TouchableOpacity onPress={showTipsDollarDialog}>
            <IconDollar width={24} height={24} />
          </TouchableOpacity>
        );
      }

      if (el.key === MultiHomeFeatTitle.History && pendingTxCount > 0) {
        return <HomePendingBadge number={pendingTxCount} />;
      }

      // 显示gift图标
      if (el.key === MultiHomeFeatTitle.GasAccount && el.showGiftIcon) {
        return <IconGift width={24} height={24} />;
      }

      return (
        <>
          {!!el.badge && el.badge > 0 ? (
            <BadgeText
              count={el.badge}
              isSuccess={el.isSuccess}
              style={[styles.badgeStyle]}
            />
          ) : null}
        </>
      );
    },
    [
      showTipsDollarDialog,
      pendingTxCount,
      styles.badgeStyle,
      hasOpenCopyTrading,
    ],
  );

  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig]);

  useEffect(() => {
    const lastReportTime =
      preferenceService.getPreference('lastReportTime') || 0;
    if (!lastReportTime || !dayjs(lastReportTime).isToday()) {
      preferenceService.setPreference({
        lastReportTime: Date.now(),
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: `Website_LikeStatus`,
        label: `LikeDapp:${
          browserService.bookmark.getState().ids?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: `Watchlist_LikeStatus`,
        label: `LikeToken:${
          preferenceService.getPreference('pinedQueue')?.length || 0
        }`,
      });
    }
  }, []);

  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();

  const { noBetweenContent } = useMemo(() => {
    const _noBetweenContent =
      !displayFundWallet &&
      !shouldShowRateGuideOnHome &&
      (!offlineChainData.displayWillClosedChain ||
        !offlineChainData.offlineChainInfo);
    return {
      noBetweenContent: _noBetweenContent,
    };
  }, [shouldShowRateGuideOnHome, offlineChainData, displayFundWallet]);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        combineData.isLoss
          ? require('@/assets2024/icons/home/homeRed.png')
          : require('@/assets2024/icons/home/homeGreen.png')
      }
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 0.26 },
      }}
      overwriteStyle={styles.screenContainer}>
      <View style={styles.paddingContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingBottom: bottom + 82,
            },
          ]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }>
          <MultiAddressHomeHeader
            data={combineData}
            loading={loading}
            loadingNewCurve={loadingNewCurve}
            onRefresh={onRefresh}
          />
          <View
            style={[
              styles.contentBetweenHeaderAndMatrix,
              noBetweenContent && styles.contentBetweenHeaderAndMatrixEmpty,
            ]}>
            <OfflineChainNotify data={offlineChainData} />

            {displayFundWallet && <FoundYourWalletGuide />}

            {shouldShowRateGuideOnHome && (
              <View
                style={{ paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL }}>
                <RateModalTriggerOnHome
                  totalBalanceText={combineData.netWorth}
                />
                <RateModal totalBalanceText={combineData.netWorth} />
              </View>
            )}
          </View>

          <View style={[{ marginTop: 0 }, styles.grid]}>
            {MENU_ARR.map((el, index) => {
              return (
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.gridItem,
                    { width: itemWidth },
                  ])}
                  key={index}
                  onPress={() => {
                    handleClickMenu(el.key);
                    matomoRequestEvent({
                      category: 'Click_Services',
                      action: `Click_${el.key}`,
                    });
                  }}>
                  <View style={styles.iconWrapper}>
                    <el.icon width={28} height={28} />
                    {generateCustomBadgeIcon(el)}
                  </View>
                  <Text style={styles.gridText}>{el.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <BrowserSearchEntry />
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  screenContainer: {
    paddingTop: 64,
  },
  paddingContainer: {
    paddingHorizontal: 0,
    flex: 1,
    flexGrow: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['red-default'],
    position: 'absolute',
    top: 0,
    right: 13,
  },
  rootScreenContainer: {
    // ...makeDebugBorder(),
    // paddingHorizontal: 20,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBox: {
    height: HeaderHeight,
    // paddingLeft: 8,
    // paddingRight: 38,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    // flex: 1,
    // backgroundColor: colors2024['neutral-title-1'],
  },
  leftBox: {
    height: HeaderHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTextBox: {
    marginRight: 12,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  balanceBox: {
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingEntry: {
    marginRight: -ITEM_LAYOUT_PADDING_HORIZONTAL,
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: ITEM_LAYOUT_PADDING_HORIZONTAL,
    position: 'relative',
  },
  usdText: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 42,
    fontFamily: 'SF Pro Rounded',
  },
  accountBg: {
    minWidth: 72,
    padding: 8,
    paddingLeft: 14,
    borderRadius: 10,
    backgroundColor: isLight
      ? ThemeColors2024.dark['neutral-bg-1']
      : colors2024['brand-default'],
    shadowColor: colors2024['brand-light-1'],
    shadowOffset: { width: 0, height: 9.411 },
    shadowOpacity: 0.1,
    shadowRadius: 22.587,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // elevation: 500,
  },
  button: {
    height: 38,
  },
  accountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    color: colors2024['neutral-InvertHighlight'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  pinBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  menuHeader: {
    height: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    marginHorizontal: 4,
    margin: 12,
    marginBottom: 16,
    marginTop: 0,
  },
  pinHeader: {
    marginTop: -8,
  },
  pinGridText: {
    color: colors2024['neutral-body'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  gridText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  iconWrapper: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeStyle: {
    // width: 20,
    // height: 20,
    // lineHeight: 20,
  },
  headerText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderRadius: 8,
    gap: 10,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
    marginTop: 20,
  },
  emptyItem: {
    backgroundColor: 'transparent',
  },
  pinGridItem: {
    backgroundColor: colord(
      isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
    )
      .alpha(0.6)
      .toRgbString(),
    borderRadius: 10,
    flexShrink: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 42,
    gap: 10,
    position: 'relative',
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderWidth: 1,
  },
  contentBetweenHeaderAndMatrix: {
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  contentBetweenHeaderAndMatrixEmpty: {},
  menuContainer: {
    marginTop: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    gap: ITEM_GRID_GAP,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
  },
  gridItem: {
    borderWidth: 2,
    borderColor: isLight
      ? colors2024['neutral-InvertHighlight']
      : 'transparent',
    backgroundColor: isLight
      ? colord(colors2024['neutral-bg-1']).alpha(0.86).toRgbString()
      : colors2024['neutral-bg-2'],
    width: '48%', // default
    minWidth: 0,
    borderRadius: 16,
    flexShrink: 0,
    padding: 18,
    paddingLeft: 20,
    paddingBottom: 16,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: 96,
    gap: 8,
    position: 'relative',
  },
  pendingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBlur: {
    paddingLeft: 20,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 0,
    width: 'auto',
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-bg-1'],
    backgroundColor: colord(
      isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
    )
      .alpha(IS_ANDROID ? 1 : 0.89)
      .toRgbString(),
  },
  pendingText: {
    marginLeft: 2,
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  floatBottom: {
    // position: 'absolute',
    // bottom: 0,
    // left: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,

    // height: 128,
  },
  search: {
    width: '100%',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    height: 60,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 28,
    gap: 8,
  },
  searchText: {
    fontSize: 22,
    lineHeight: 28,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },

  noAssetsContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    paddingBottom: 50,
    borderRadius: 50,
    overflow: 'hidden',
  },
  bgLeft: { position: 'absolute', top: 0, left: 0 },
  bgRight: { position: 'absolute', top: 35, right: 0 },
  bgb1: {
    position: 'absolute',
    top: 52,
    left: 16,
    transform: [{ scale: 0.5 }],
  },
  bgb2: {
    position: 'absolute',
    top: 76,
    right: 34,
    transform: [{ scale: 0.5 }],
  },
  noAssetsTitle: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 36,
    marginVertical: 42,
  },

  noAssetsItem: {
    paddingHorizontal: 16,
    paddingVertical: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  noAssetsIconWrapper: {
    width: 28,
    height: 28,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 9.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyIcon: {
    alignSelf: 'flex-start',
  },
  noAssetsRight: {
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  noAssetsItemName: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  noAssetsItemDesc: {
    maxWidth: '100%',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
  },
  hidden: {
    display: 'none',
  },
  curveBox: {
    paddingHorizontal: 15,
    paddingTop: 30,
  },
  curveCard: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    height: 128,
    borderWidth: 0,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shadowView: {
    ...Platform.select({
      ios: {
        shadowColor: colors2024['neutral-black'],
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  curveContainer: {
    gap: 10,
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 30,
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: -16,
  },
}));

export default MultiAddressHome;
