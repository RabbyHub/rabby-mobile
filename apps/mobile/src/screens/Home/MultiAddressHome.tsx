import RcIconApprovalsCC from '@/assets2024/icons/home/IconApprovalsCC.svg';
import RcIconBridgeCC from '@/assets2024/icons/home/IconBridgeCC.svg';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';
import RcIconGasAccountCC from '@/assets2024/icons/home/IconGasAccountCC.svg';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import RcIconHistoryCC from '@/assets2024/icons/home/IconHistoryCC.svg';
import RcIconReceiveCC from '@/assets2024/icons/home/IconReceiveCC.svg';
import RcIconSendCC from '@/assets2024/icons/home/icon-send-cc.svg';
import RcIconSwapCC from '@/assets2024/icons/home/icon-swap-cc.svg';
import RcIconWatchlistCC from '@/assets2024/icons/home/IconWatchlistCC.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDappsCC.svg';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import RcIconPointsCC from '@/assets2024/icons/home/IconPointsCC.svg';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  LayoutRectangle,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { apisAccount } from '@/core/apis';
import {
  browserService,
  currencyService,
  gasAccountService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { useMyAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { resetNavigationTo } from '@/hooks/navigation';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { matomoRequestEvent } from '@/utils/analytics';
import { navigateDeprecated } from '@/utils/navigation';
import { useAppState } from '@react-native-community/hooks';
import { useMemoizedFn } from 'ahooks';
import { debounce, unionBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSortAddressList } from '../Address/useSortAddressList';
import { BadgeText } from './components/BadgeText';
import { useApprovalAlertCounts } from './hooks/approvals';

import RcIconPerps from '@/assets2024/icons/home/IconPerps.svg';
import RcIconLending from '@/assets2024/icons/home/IconLending.svg';
import { RateModal } from '@/components/RateModal/RateModal';
import { RateModalTriggerOnHome } from '@/components/RateModal/RateModalTriggerOnHome';
import { useExposureRateGuide } from '@/components/RateModal/hooks';
import { TipFeedbackByScreenshot } from '@/components/Screenshot/HomeCenterTip';
import {
  useSetTotalBalanceText,
  useViewedHomeTip,
} from '@/components/Screenshot/hooks';
import { isNonPublicProductionEnv } from '@/constant';
import {
  HOME_REFRESH_INTERVAL,
  ITEM_GRID_GAP,
  ITEM_LAYOUT_PADDING_HORIZONTAL,
} from '@/constant/home';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { useFetchCexInfo } from '@/hooks/useAddrDesc';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { useMulti24hBalance } from '@/hooks/use24hBalance';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { colord } from 'colord';
import dayjs from 'dayjs';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { BrowserSearchEntry } from '../Browser/components/BrowserSearchEntry';
import { useTipsDollarDialog } from '../CopyTrading/component/hooks';
import { useInitDetectDBAssets } from '../Search/useAssets';
import { useMockDataForHomeCenterArea } from '../Settings/sheetModals/DevUIHomeCenterArea';
import { FoundYourWalletGuide } from './FundYourWallet';
import { HomePendingBadge } from './components/HomePending';
import {
  OfflineChainNotify,
  useOfflineChain,
} from './components/OfflineChainNotify';
import { PerpsPnl } from './components/PerpsPnl';
import { MultiAddressHomeHeader } from './components/MultiAddressHomeHeader';
import { LendingHF } from './components/LendingHF';
import { useLendingData } from '../Lending/hooks';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import { GradientOutlineContainer } from '@/components2024/GradientOutlineContainer';
import { WatchListBadge } from '../Watchlist/components/WatchListBadge';
import { PointsBadge } from '../Points/components/PointsBadge';
import { DappsBadge } from '../Browser/BrowserScreen/components/DappsBadge';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { GlobalSearchBar } from '../Search/components/SearchBar';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { Tabs } from 'react-native-collapsible-tab-view';
import { TabsMultiAssets } from '../Address/components/MultiAssets/TabsMultiAssets';

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

  // add gift eligibility check hook
  const { checkAddressesEligibility, getCurrentEligibleAddress } =
    useGasAccountEligibility();
  const currentEligibleAddress = getCurrentEligibleAddress();
  const timeRef = useRef<null | NodeJS.Timer>(null);
  const appState = useAppState();
  const gasAccountSig = gasAccountService.getGasAccountSig();
  const hasClaimedGift = gasAccountService.getHasClaimedGift();
  const { width } = Dimensions.get('window');
  const itemWidth =
    (width -
      ITEM_LAYOUT_PADDING_HORIZONTAL * 2 -
      8 * 2 -
      1.5 * 2 -
      ITEM_GRID_GAP -
      2) /
    2;
  // use useMemo to directly calculate isEligible so that it can respond to related state changes
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
  const { fetchData: fetchLendingData } = useLendingData();

  const MENU_ARR = useMemo(
    () =>
      [
        // {
        //   key: MultiHomeFeatTitle.Swap,
        //   title: t('page.home.services.swap'),
        //   icon: RcIconSwapCC,
        // },
        // {
        //   key: MultiHomeFeatTitle.Send,
        //   title: t('page.home.services.send'),
        //   icon: RcIconSendCC,
        // },
        {
          key: MultiHomeFeatTitle.Receive,
          title: t('page.home.services.receive'),
          icon: RcIconReceiveCC,
        },
        {
          key: MultiHomeFeatTitle.Bridge,
          title: t('page.home.services.bridge'),
          icon: RcIconBridgeCC,
        },
        // {
        //   key: MultiHomeFeatTitle.CopyTrading,
        //   title: t('page.home.services.copyTrading'),
        //   icon: RcIconCopyTrading,
        // },
        {
          key: MultiHomeFeatTitle.Perps,
          title: t('page.home.services.perps'),
          icon: RcIconPerps,
        },
        {
          key: MultiHomeFeatTitle.Lending,
          title: t('page.home.services.lending'),
          icon: RcIconLending,
          color: colors2024['brand-default-icon'],
        },
        {
          key: MultiHomeFeatTitle.Points,
          title: t('page.rabbyPoints.title'),
          icon: RcIconPointsCC,
        },
        {
          key: MultiHomeFeatTitle.History,
          title: t('page.home.services.history'),
          icon: RcIconHistoryCC,
          badge: historyCount?.fail || historyCount?.success,
          isSuccess: !historyCount?.fail,
        },
        {
          key: MultiHomeFeatTitle.Approvals,
          title: t('page.home.services.approvals'),
          icon: RcIconApprovalsCC,
          badge: alertInfo.total,
        },
        {
          key: MultiHomeFeatTitle.Dapps,
          title: IS_IOS
            ? t('page.home.services.websites')
            : t('page.home.services.dapps'),
          icon: RcIconDapps,
        },
        {
          key: MultiHomeFeatTitle.GasAccount,
          title: t('page.home.services.gasAccount'),
          icon: RcIconGasAccountCC,
          showGiftIcon: isEligible,
        },
        // __DEV__ && {
        //   title: MultiHomeFeatTitle.TEST_DAPP,
        //   icon: RcIconDapps,
        // },
        {
          key: MultiHomeFeatTitle.Watchlist,
          title: t('page.home.services.watchlist'),
          icon: RcIconWatchlistCC,
        },
        // {
        //   title: MultiHomeFeatTitle.Ecosystem,
        //   icon: RcIconEcosystem,
        // },
      ].filter(Boolean) as {
        key: MultiHomeFeatTitle;
        title: string;
        icon: React.FC<import('react-native-svg').SvgProps>;
        color?: string;
        badge?: number;
        isSuccess?: boolean;
        showGiftIcon?: boolean;
      }[],
    [
      t,
      colors2024,
      historyCount?.fail,
      historyCount?.success,
      alertInfo.total,
      isEligible,
    ],
  );

  const swapButtonShadow = useMemo<ViewStyle>(() => {
    return (Platform.select({
      ios: {
        shadowColor: 'rgba(112, 132, 255, 1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }) || {}) as ViewStyle;
  }, []);

  const PRIMARY_ACTIONS = useMemo(
    () =>
      [
        {
          key: MultiHomeFeatTitle.Send,
          title: t('page.home.services.send'),
          icon: RcIconSendCC,
          backgroundColor: colors2024['green-default'],
        },
        {
          key: MultiHomeFeatTitle.Swap,
          title: t('page.home.services.swap'),
          icon: RcIconSwapCC,
          backgroundColor: colors2024['brand-default-icon'],
          extraStyle: swapButtonShadow,
        },
      ] as Array<{
        key: MultiHomeFeatTitle;
        title: string;
        icon: React.FC<import('react-native-svg').SvgProps>;
        backgroundColor: string;
        extraStyle?: ViewStyle;
      }>,
    [colors2024, swapButtonShadow, t],
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
  } = useMulti24hBalance(
    top10Addresses,
    true,
    top10Balance.total,
    top10Balance.totalEvm,
  );
  useCexSupportList();
  useFetchCexInfo();
  useInitDetectDBAssets();
  useSetTotalBalanceText(combineData.netWorth);

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);

  // 获取top50的私钥助记词账户
  const top50PrivateKeyAccounts = useMemo(() => {
    console.debug('top50PrivateKeyAccounts', sortedAccounts);
    return sortedAccounts
      .filter(
        account =>
          account.type == KEYRING_TYPE.SimpleKeyring ||
          account.type == KEYRING_TYPE.HdKeyring,
      )
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

  const { syncTop10History } = useSyncHistoryDB(top10Addresses);

  const { mockData } = useMockDataForHomeCenterArea();

  const displayFundWalletOrig = useMemo(() => {
    return (
      !!balanceAccounts.length &&
      balanceAccounts.every(e => e.balance === 0) &&
      balanceCacheAccounts.every(e => e.balance === 0) &&
      balanceAccounts.every(
        e =>
          transactionHistoryService.getTransactionGroups({ address: e.address })
            .length === 0,
      )
    );
  }, [balanceAccounts, balanceCacheAccounts]);

  const displayFundWallet = useMemo(() => {
    if (isNonPublicProductionEnv && mockData.forceShowFundWallet) {
      return true;
    }
    return displayFundWalletOrig;
  }, [displayFundWalletOrig, mockData.forceShowFundWallet]);

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
      deleteLongTime24hBalanceCache();
    }, 0);
  }, []);

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
    list.forEach(i => {
      const status = i.status ?? 1;
      const id = `${i.owner_addr.toLowerCase()}-${i.txHash}`;
      if (i.tx_from_address === i.owner_addr) {
        return;
      }
      const addressTs =
        clearSuccessAndFailListTsObj[i.owner_addr.toLowerCase()] ?? Date.now();
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
  useFocusEffect(
    useCallback(() => {
      if (appState === 'active') {
        refreshCurve();
      }
    }, [appState, refreshCurve]),
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
        syncTop10History();
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
      fetchLendingData();
      syncTop10History(true);
      currencyService.syncCurrencyList(true);
    });
  }, [
    triggerUpdate,
    refreshCurve,
    checkAddressesEligibility,
    top50PrivateKeyAccounts,
    forceUpdate,
    fetchLendingData,
    syncTop10History,
  ]);

  const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
  const handlePressWatchlist = useCallback(() => {
    navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
      screen: RootNames.Watchlist,
      params: {},
    });
  }, [navigation]);

  const { setPartialBrowserState, forceShowBrowser } = useBrowser();

  const openDapps = useMemoizedFn(() => {
    setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: true,
      searchText: '',
      searchTabId: '',
      trigger: 'home',
    });
    forceShowBrowser();
  });

  const handleClickMenu = useCallback(
    (key: MultiHomeFeatTitle) => {
      switch (key) {
        case MultiHomeFeatTitle.Send:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Send,
              params: {},
            }),
          );
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
          navigateDeprecated(RootNames.StackAddress, {
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
        case MultiHomeFeatTitle.Perps:
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Perps,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.Lending:
          navigation.navigate(RootNames.StackTransaction, {
            screen: RootNames.Lending,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.Points:
          navigation.push(RootNames.StackAddress, {
            screen: RootNames.Points,
            params: {},
          });
          break;

        case MultiHomeFeatTitle.Dapps: {
          openDapps();
          break;
        }
        default:
          break;
      }
    },
    [openDapps, handlePressWatchlist, navigation, toggleUseAllAccountsOnScene],
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
      if (el.key === MultiHomeFeatTitle.Watchlist) {
        return <WatchListBadge />;
      }
      if (el.key === MultiHomeFeatTitle.CopyTrading && !hasOpenCopyTrading) {
        return (
          <TouchableOpacity onPress={showTipsDollarDialog}>
            <IconDollar width={24} height={24} />
          </TouchableOpacity>
        );
      }

      if (el.key === MultiHomeFeatTitle.Perps) {
        return <PerpsPnl />;
      }

      if (el.key === MultiHomeFeatTitle.History && pendingTxCount > 0) {
        return <HomePendingBadge number={pendingTxCount} />;
      }

      // 显示gift图标
      if (el.key === MultiHomeFeatTitle.GasAccount && el.showGiftIcon) {
        return <IconGift width={24} height={24} />;
      }

      if (el.key === MultiHomeFeatTitle.Lending) {
        return <LendingHF />;
      }

      if (el.key === MultiHomeFeatTitle.Points) {
        return <PointsBadge />;
      }

      if (el.key === MultiHomeFeatTitle.Dapps) {
        return <DappsBadge />;
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
      hasOpenCopyTrading,
      pendingTxCount,
      showTipsDollarDialog,
      styles.badgeStyle,
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
        action: 'Website_LikeStatus',
        label: `LikeDapp:${
          browserService.bookmark.getState().ids?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_TabStatus',
        label: `TabNumber:${
          browserService.getBrowserTabs()?.tabs?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_LikeStatus',
        label: `LikeToken:${
          preferenceService.getPreference('pinedQueue')?.length || 0
        }`,
      });
    }
  }, []);

  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();
  const { viewedHomeTip } = useViewedHomeTip();

  const { noBetweenContent, onlyOneContent } = useMemo(() => {
    const visibleEls = [
      displayFundWallet,
      shouldShowRateGuideOnHome,
      offlineChainData.displayWillClosedChain &&
        offlineChainData.offlineChainInfo,
      !viewedHomeTip,
    ];
    const hasBetweenContent = visibleEls.some(Boolean);
    return {
      noBetweenContent: !hasBetweenContent,
      onlyOneContent: visibleEls.filter(Boolean).length === 1,
    };
  }, [
    shouldShowRateGuideOnHome,
    offlineChainData,
    displayFundWallet,
    viewedHomeTip,
  ]);

  const [tabIndex, setTabIndex] = useState(0);
  const handleIndexChange = useCallback((_index: number) => {
    setTabIndex(_index);
  }, []);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        combineData.isLoss
          ? require('@/assets2024/singleHome/loss-home.png')
          : require('@/assets2024/singleHome/up-home.png')
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
      <ScreenSpecificStatusBar screenName={RootNames.Home} />
      <View style={[styles.paddingContainer]}>
        <TabsMultiAssets
          onRefresh={onRefresh}
          data={combineData}
          loading={loading}
          tabIndex={tabIndex}
          onIndexChange={handleIndexChange}
          overViewContent={
            <Tabs.ScrollView
              tvParallaxProperties={undefined}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContainer,
                {
                  // paddingBottom: bottom + 82,
                  paddingBottom:
                    Platform.OS === 'android' ? Math.max(bottom, 16) : 16,
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
                balanceAccounts={balanceAccounts}
              />
              <View
                style={[
                  noBetweenContent
                    ? styles.contentBetweenHeaderAndMatrixEmpty
                    : styles.contentBetweenHeaderAndMatrix,
                  onlyOneContent
                    ? styles.contentBetweenHeaderAndMatrixOnlyOne
                    : null,
                ]}>
                <OfflineChainNotify data={offlineChainData} />

                {displayFundWallet && <FoundYourWalletGuide />}

                {shouldShowRateGuideOnHome && (
                  <View
                    style={{
                      paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
                    }}>
                    <RateModalTriggerOnHome
                      totalBalanceText={combineData.netWorth}
                    />
                    <RateModal totalBalanceText={combineData.netWorth} />
                  </View>
                )}

                <TipFeedbackByScreenshot />
              </View>

              <View style={[{ marginTop: 0 }, styles.grid]}>
                <GradientOutlineContainer
                  contentStyle={styles.gridGradientOutline}>
                  <View style={styles.primaryActionsContainer}>
                    {PRIMARY_ACTIONS.map(action => {
                      const ActionIcon = action.icon;
                      return (
                        <TouchableOpacity
                          key={action.key}
                          style={[
                            styles.primaryActionButton,
                            { backgroundColor: action.backgroundColor },
                            action.extraStyle,
                          ]}
                          onPress={() => {
                            handleClickMenu(action.key);
                            matomoRequestEvent({
                              category: 'Click_Services',
                              action: `Click_${action.key}`,
                            });
                          }}>
                          <ActionIcon
                            width={22}
                            height={22}
                            color={colors2024['neutral-InvertHighlight']}
                          />
                          <Text style={styles.primaryActionText}>
                            {action.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.gridItemsWrap}>
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
                          <View style={styles.badgeWrapper}>
                            <View style={styles.iconWrapper}>
                              <el.icon
                                width={22}
                                height={22}
                                color={
                                  el.color || colors2024['brand-default-icon']
                                }
                              />
                            </View>
                            <View style={styles.rightBadgeWrapper}>
                              {generateCustomBadgeIcon(el)}
                            </View>
                          </View>
                          <Text style={styles.gridText}>{el.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </GradientOutlineContainer>
                <BrowserSearchEntry alwaysShowSearch={false} />
                <View style={styles.searchBarPlaceholder} />
              </View>
            </Tabs.ScrollView>
          }
        />

        {/* show search bar when Overview tab */}
        {tabIndex === 0 && (
          <View style={styles.globalSearchBar}>
            <GlobalSearchBar />
          </View>
        )}
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  screenContainer: {
    paddingTop: 0,
  },
  paddingContainer: {
    paddingHorizontal: 0,
    flex: 1,
    flexGrow: 1,
  },
  container: {
    borderWidth: 1,
    borderColor: 'red',
    flexGrow: 1,
    minHeight: '100%',
  },
  headerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 64,
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
  scroll: {
    flex: 1,
    marginTop: -46,
  },
  scrollContainer: {
    // paddingTop: 88,
    flexGrow: 1,
    minHeight: '100%',
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
  badgeWrapper: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    height: 36,
    width: 36,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightBadgeWrapper: {
    position: 'relative',
    right: -4,
    alignSelf: 'flex-start',
  },
  badgeStyle: {},
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
    // ...makeDebugBorder(),
  },
  contentBetweenHeaderAndMatrixEmpty: {
    marginBottom: 12,
  },
  contentBetweenHeaderAndMatrixOnlyOne: {
    paddingTop: 0,
  },
  menuContainer: {
    marginTop: 0,
  },
  grid: {
    // flexDirection: 'row',
    // flexWrap: 'wrap',
    // borderRadius: 8,
    // gap: ITEM_GRID_GAP,
    // justifyContent: 'space-between',
    // alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
    // paddingHorizontal: 8,
    // paddingVertical: 12,
    // paddingTop: 16,re
  },
  gridGradientOutline: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 12,
    width: '100%',
    gap: 16,
  },
  gridItemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    rowGap: ITEM_GRID_GAP + 2,
    columnGap: ITEM_GRID_GAP,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  primaryActionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },

  gridItem: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    width: '48%', // default
    minWidth: 0,
    borderRadius: 16,
    flexShrink: 0,
    padding: 16,
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
    paddingTop: 12,
  },
  curveCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 0,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    backgroundColor: 'transparent',
  },
  curveCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
    gap: 6,
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 30,
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 46,
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
  searchBarPlaceholder: {
    height: 80,
  },
  globalSearchBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 22,
  },
}));

export default MultiAddressHome;
