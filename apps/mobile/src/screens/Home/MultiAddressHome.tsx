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
  Pressable,
} from 'react-native';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { trigger } from 'react-native-haptic-feedback';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import RcPending from '@/assets2024/icons/home/pending.svg';
import RcIconOrangeArrow from '@/assets2024/icons/home/IconOrangeArrow.svg';
import {
  useGetBinaryMode,
  useTheme2024,
  useAppThemeConfig,
} from '@/hooks/theme';
import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import { RootNames, ScreenLayouts } from '@/constant/layout';
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
import RcIconSearch from '@/assets2024/icons/home/IconSearch.svg';

import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { splitNumberByStep } from '@/utils/number';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { transactionHistoryService } from '@/core/services';
import { useMemoizedFn } from 'ahooks';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import LinearGradient from 'react-native-linear-gradient';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { matomoRequestEvent } from '@/utils/analytics';
import { apisAccount } from '@/core/apis';
import { resetNavigationTo } from '@/hooks/navigation';
import { navigate } from '@/utils/navigation';
import { useApprovalAlertCounts } from './hooks/approvals';
import { BadgeText } from './components/HomeTopArea';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import useHomePinAddress from './hooks/useHomePinAddress';
import { ThemeColors2024 } from '@/constant/theme';
import { useAppState } from '@react-native-community/hooks';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { ellipsisAddress } from '@/utils/address';
import { useSyncAssetsDB } from '@/databases/hooks/assets';
import { useSortAddressList } from '../Address/useSortAddressList';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { unionBy } from 'lodash';
import { useUpgradeInfo } from '@/hooks/version';

import RcIconBuy from '@/assets2024/icons/home/IconBuy.svg';
import IconRabby from '@/assets2024/icons/home/IconRabby.svg';
import { FundYourWallet } from './FundYourWallet';
import { OfflineChainNotify } from './components/OfflineChainNotify';
import { colord } from 'colord';
import { BlurView } from '@/components';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useAddrDescAccounts } from '@/hooks/useAddrDesc';

const HeaderHeight = 24;

export function MultiAddressHomeHeader(prop): JSX.Element {
  const { loading } = prop;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { balanceAccounts, accountsLength } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });
  const needSmallNum = useMemo(() => {
    const num = balanceAccounts.reduce(
      (sum, item) => sum + (Number(item.balance) || 0),
      0,
    );
    return num >= 1000000000;
  }, [balanceAccounts]);
  const spinValue = useRef(new Animated.Value(0)).current;
  const { remoteVersion } = useUpgradeInfo();
  const totalBalanceUsd = useMemo(() => {
    const num = balanceAccounts.reduce(
      (sum, item) => sum + (Number(item.balance) || 0),
      0,
    );
    return '$' + splitNumberByStep((num || 0).toFixed(2));
  }, [balanceAccounts]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
    <View>
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
          <RcIconSetting />
          {remoteVersion.couldUpgrade && <View style={styles.redDot} />}
        </TouchableWithoutFeedback>
      </View>
      <View style={styles.balanceBox}>
        <Text
          style={[
            styles.usdText,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              fontSize: needSmallNum ? 28 : 36,
            },
          ]}>
          {totalBalanceUsd}
        </Text>
        <TouchableOpacity
          style={styles.accountBg}
          onPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
            navigation.dispatch(
              StackActions.push(RootNames.StackAddress, {
                screen: RootNames.AddressList,
                params: {},
              }),
            );
            matomoRequestEvent({
              category: 'Click_Header',
              action: 'Click_Address',
            });
          }}>
          <RcIconSmallWallet />
          <Text style={styles.accountText}>{accountsLength}</Text>
          <RcIconSmallArrow />
        </TouchableOpacity>
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
  const { styles, colors2024, isLight, appThemeMode } = useTheme2024({
    getStyle,
  });
  const appThemeConfig = useAppThemeConfig();
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [historyCount, setHistoryCount] = useState<{
    success: number;
    fail: number;
  }>();
  const timeRef = useRef<null | NodeJS.Timer>(null);
  const { switchAccount } = useCurrentAccount();
  const appState = useAppState();

  const { width } = Dimensions.get('window');
  const itemWidth =
    (width - ITEM_LAYOUT_PADDING_HORIZONTAL * 2 - ITEM_GRID_GAP - 2) / 2;

  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
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
          key: MultiHomeFeatTitle.Buy,
          title: t('page.buy.title'),
          icon: RcIconBuy,
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
        },
        // __DEV__ && {
        //   title: MultiHomeFeatTitle.TEST_DAPP,
        //   icon: RcIconDapps,
        // },
        {
          key: MultiHomeFeatTitle.Dapps,
          title: IS_IOS
            ? t('page.home.services.websites')
            : t('page.home.services.dapps'),
          icon: RcIconDapps,
        },
        {
          key: MultiHomeFeatTitle.Search,
          title: t('page.home.services.search'),
          icon: RcIconSearch,
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
      }[],
    [alertInfo.total, t, historyCount],
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
    balanceLoading,
    accountsLength,
  } = useAccountsBalance({
    cacheTime: HOME_REFRESH_INTERVAL, // 5 minutes
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });
  useAddrDescAccounts();

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);

  const { syncTop10Assets } = useSyncAssetsDB(unionAccounts);
  const { syncTop10History } = useSyncHistoryDB(unionAccounts);

  const { pinAccountsFirstFour, isShowPin, unPinAddress } =
    useHomePinAddress(balanceAccounts);

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

  // useMount(() => {  no use ?
  //   eventBus.addListener(EVENTS.TX_COMPLETED, fetchHistory);
  //   return () => {
  //     eventBus.removeListener(EVENTS.TX_COMPLETED, fetchHistory);
  //   };
  // });

  const getSuccessAndFailList = useCallback(() => {
    const count = transactionHistoryService.getFailedCount();
    const success = transactionHistoryService.getSucceedCount();

    setHistoryCount({
      success: success,
      fail: count,
    });
  }, [setHistoryCount]);

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
      if (appState === 'active') {
        triggerUpdate();
        triggerUpdateAlert();
        syncTop10Assets();
        syncTop10History();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      triggerUpdate,
      triggerUpdateAlert,
      appState,
      getSuccessAndFailList,
      sortedAccounts.length,
    ]),
  );

  const onRefresh = useCallback(() => {
    triggerUpdate(true); // force update balance from server api
    forceUpdate();
    syncTop10Assets(true);
    syncTop10History(true);
  }, [triggerUpdate, forceUpdate, syncTop10Assets, syncTop10History]);

  const totalBalance = useMemo(() => {
    const num = balanceAccounts.reduce(
      (sum, item) => sum + (Number(item.balance) || 0),
      0,
    );
    return num;
  }, [balanceAccounts]);

  const calcPinPercent = useCallback(
    (balance: number) => {
      let percent = 0;
      if (balance && totalBalance) {
        percent = Math.floor((balance / totalBalance) * 100);
      }
      return `${percent}%`;
    },
    [totalBalance],
  );

  const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
  const { navigateToSendPolyScreen } = useSendRoutes();
  const handlePressSearch = useCallback(() => {
    navigation.navigate(RootNames.StackHomeNonTab, {
      screen: RootNames.Search,
      params: {},
    });
  }, [navigation]);

  const handleClickMenu = useCallback(
    (key: MultiHomeFeatTitle) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
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
        case MultiHomeFeatTitle.Dapps:
          navigation.navigate(RootNames.StackDapps, {
            screen: RootNames.Dapps,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.Search: {
          handlePressSearch();
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
        default:
          break;
      }
    },
    [
      handlePressSearch,
      navigateToSendPolyScreen,
      navigation,
      toggleUseAllAccountsOnScene,
    ],
  );

  const handleClickPinAccount = useCallback(
    (pinItem: KeyringAccountWithAlias) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });

      switchAccount(pinItem);
      navigation.dispatch(
        StackActions.push(RootNames.SingleAddressStack, {
          screen: RootNames.SingleAddressHome,
          params: {},
        }),
      );
    },
    [switchAccount, navigation],
  );

  const { bottom } = useSafeAreaInsets();
  const isDarkTheme = useGetBinaryMode() === 'dark';

  useEffect(() => {
    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig]);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={require('@/assets2024/icons/home/ImgBgHome.png')}
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 0.26 },
      }}
      overwriteStyle={{
        paddingTop: 64,
      }}>
      <View style={styles.paddingContainer}>
        <MultiAddressHomeHeader loading={balanceLoading} />
        {pendingTxCount > 0 && (
          <View style={[styles.pendingContainer]} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => handleClickMenu(MultiHomeFeatTitle.History)}>
              <BlurView
                style={styles.pendingBlur}
                blurType={appThemeMode ?? 'light'}
                blurAmount={2}>
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}>
                  <RcPending width={21} height={21} />
                </Animated.View>
                <Text style={styles.pendingText}>{`${pendingTxCount} ${t(
                  'page.bridge.Pending',
                )}`}</Text>
                <RcIconOrangeArrow width={21} height={21} />
              </BlurView>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingBottom: bottom,
            },
          ]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }>
          {isShowPin && (
            <View style={[styles.pinGrid]}>
              {pinAccountsFirstFour.map((item, index) => {
                return item ? (
                  <ContextMenuView
                    menuConfig={{
                      menuTitle: item.alias || ellipsisAddress(item.address),
                      menuActions: [
                        ...(IS_ANDROID
                          ? [
                              {
                                title:
                                  item.alias || ellipsisAddress(item.address),
                                key: 'hostname',
                                icon: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png'),
                                disabled: true,
                                action() {},
                              },
                            ]
                          : []),
                        {
                          title: 'UnPin',
                          icon: isDarkTheme
                            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
                            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
                          androidIconName: 'ic_rabby_menu_un_pin',
                          key: 'pin',
                          action() {
                            unPinAddress(item.address, item.brandName);
                          },
                        },
                      ],
                    }}
                    key={`${item.address}-${item.brandName}`}
                    preViewBorderRadius={10}
                    triggerProps={{ action: 'longPress' }}>
                    <TouchableOpacity
                      key={index}
                      delayLongPress={200} // long press delay
                      onLongPress={() => {
                        trigger('impactLight', {
                          enableVibrateFallback: true,
                          ignoreAndroidSystemSettings: false,
                        });
                      }}
                      onPress={() => {
                        handleClickPinAccount(item);
                        matomoRequestEvent({
                          category: 'Click_Pin',
                          action: `Click_${index}`,
                        });
                      }}>
                      <BlurView
                        blurType={appThemeMode ?? 'light'}
                        blurAmount={2}
                        style={StyleSheet.flatten([styles.pinGridItem])}>
                        <WalletIcon
                          type={item.brandName}
                          width={18}
                          height={18}
                          borderRadius={5}
                        />
                        <Text style={styles.pinGridText}>
                          {calcPinPercent(item.balance || 0)}
                        </Text>
                      </BlurView>
                    </TouchableOpacity>
                  </ContextMenuView>
                ) : null;
              })}
            </View>
          )}
          <OfflineChainNotify />
          {displayFundWallet && (
            <>
              <View
                style={[styles.menuHeader, { justifyContent: 'flex-start' }]}>
                <IconRabby />
                <Text style={styles.headerText}>
                  {t('page.nextComponent.multiAddressHome.noAssets')}
                </Text>
              </View>
              <FundYourWallet />
            </>
          )}
          <View
            style={[
              { marginTop: 0 },
              styles.grid,
              displayFundWallet && styles.hidden,
            ]}>
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
                    <el.icon />
                    {!!el.badge && el.badge > 0 && (
                      <BadgeText
                        count={el.badge}
                        isSuccess={el.isSuccess}
                        style={[styles.badgeStyle]}
                      />
                    )}
                  </View>
                  <Text style={styles.gridText}>{el.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
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
    top: 15,
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
    fontWeight: '900',
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
    borderRadius: 94,
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
    color: colors2024['neutral-body'],
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
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
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    position: 'relative',
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    width: '48%', // default
    minWidth: 0,
    borderRadius: 18,
    flexShrink: 0,
    padding: 20,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: 96,
    gap: 12,
    position: 'relative',
  },
  pendingContainer: {
    position: 'absolute',
    top: -7,
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
}));

export default MultiAddressHome;
