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
  TouchableWithoutFeedback,
  RefreshControl,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { IS_IOS } from '@/core/native/utils';
import { trigger } from 'react-native-haptic-feedback';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import RcPending from '@/assets2024/icons/home/pending.svg';
import RcIconOrangeArrow from '@/assets2024/icons/home/IconOrangeArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import RcIconSend from '@/assets2024/icons/home/IconSend.svg';
import RcIconReceive from '@/assets2024/icons/home/IconReceive.svg';
import RcIconSwap from '@/assets2024/icons/home/IconSwap.svg';
import RcIconBridge from '@/assets2024/icons/home/IconBridge.svg';
import RcIconHistory from '@/assets2024/icons/home/IconHistory.svg';
import RcIconloading from '@/assets2024/icons/home/Iconloading.svg';
import RcIconVectorCC from '@/assets2024/icons/home/IconVectorCC.svg';
import RcIconGasAccount from '@/assets2024/icons/home/IconGasAccount.svg';
import RcIconApprovals from '@/assets2024/icons/home/IconApprovals.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDapps.svg';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { splitNumberByStep } from '@/utils/number';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { transactionHistoryService } from '@/core/services';
import { useMemoizedFn } from 'ahooks';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { matomoRequestEvent } from '@/utils/analytics';
import { apisAccount } from '@/core/apis';
import { resetNavigationTo } from '@/hooks/navigation';
import { navigate } from '@/utils/navigation';
import { useApprovalAlertCounts } from './hooks/approvals';
import { BadgeText } from './components/HomeTopArea';
import { useDappWebViewScreen } from '../Dapps/hooks/useDappWebViewScreen';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
  usePinAddresses,
} from '@/hooks/account';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import useHomePinAddress from './hooks/useHomePinAddress';
import { ThemeColors2024 } from '@/constant/theme';
import { useAppState } from '@react-native-community/hooks';

export function MultiAddressHomeHeader(prop): JSX.Element {
  const { loading } = prop;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;

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
    <View style={styles.headerBox}>
      <View style={styles.headerBox}>
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
        onPress={() => {
          navigation.navigate(RootNames.StackRoot, {
            screen: RootNames.Settings,
            params: {},
          });

          matomoRequestEvent({
            category: 'Click_Header',
            action: 'Click_Setting',
          });
        }}>
        <RcIconSetting />
      </TouchableWithoutFeedback>
    </View>
  );
}

const ITEM_LAYOUT_PADDING_HORIZONTAL = 16;
const ITEM_GRID_GAP = 12;
const HOME_REFRESH_INTERVAL = 10 * 60 * 1000;

function MultiAddressHome(): JSX.Element {
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const [pendingTxCount, setPendingTxCount] = useState(0);
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

  const MENU_ARR = [
    {
      title: MultiHomeFeatTitle.Swap,
      icon: RcIconSwap,
    },
    {
      title: MultiHomeFeatTitle.Send,
      icon: RcIconSend,
    },
    {
      title: MultiHomeFeatTitle.Receive,
      icon: RcIconReceive,
    },
    {
      title: MultiHomeFeatTitle.Bridge,
      icon: RcIconBridge,
    },
    {
      title: MultiHomeFeatTitle.History,
      icon: RcIconHistory,
    },
    {
      title: MultiHomeFeatTitle.Approvals,
      icon: RcIconApprovals,
      badge: alertInfo.total,
    },
    {
      title: MultiHomeFeatTitle.GasAccount,
      icon: RcIconGasAccount,
    },
    // __DEV__ && {
    //   title: MultiHomeFeatTitle.TEST_DAPP,
    //   icon: RcIconDapps,
    // },
    {
      title: MultiHomeFeatTitle.Dapps,
      icon: RcIconDapps,
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
    title: MultiHomeFeatTitle;
    icon: React.FC<import('react-native-svg').SvgProps>;
    badge?: number;
  }[];

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

  const { pinAccountsFirstFour, isShowPin } =
    useHomePinAddress(balanceAccounts);

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
  }, [balanceCacheAccounts]);

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
      if (appState === 'active') {
        triggerUpdate();
        triggerUpdateAlert();
      }
    }, [triggerUpdate, triggerUpdateAlert, appState]),
  );

  const onRefresh = useCallback(() => {
    triggerUpdate(true); // force update balance from server api
    forceUpdate();
  }, [forceUpdate, triggerUpdate]);

  const needSmallNum = useMemo(() => {
    const num = balanceAccounts.reduce(
      (sum, item) => sum + (Number(item.balance) || 0),
      0,
    );
    return num >= 1000000000;
  }, [balanceAccounts]);

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

  const totalBalanceUsd = useMemo(() => {
    const num = balanceAccounts.reduce(
      (sum, item) => sum + (Number(item.balance) || 0),
      0,
    );
    return '$' + splitNumberByStep((num || 0).toFixed(2));
  }, [balanceAccounts]);

  const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();

  const { openUrlAsDapp } = useDappWebViewScreen();

  const handleClickMenu = useCallback(
    (title: MultiHomeFeatTitle) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      switch (title) {
        case MultiHomeFeatTitle.Send:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiSend,
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
          navigation.navigate(RootNames.StackRoot, {
            screen: RootNames.Dapps,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.TEST_DAPP:
          openUrlAsDapp('https://metamask.github.io/test-dapp/', {
            forceReopen: true,
          });
          navigation.navigate(RootNames.StackRoot, {
            screen: RootNames.DappWebViewStubOnHome,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.Ecosystem:
          break;
        default:
          break;
      }
    },
    [navigation, toggleUseAllAccountsOnScene, openUrlAsDapp],
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

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={require('@/assets2024/icons/home/ImgBgHome.png')}
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0.2072, 0.3181],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      }}>
      <View style={styles.paddingContainer}>
        <MultiAddressHomeHeader loading={balanceLoading} />
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }>
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
          {isShowPin && (
            <>
              <View style={[styles.menuHeader, styles.pinHeader]}>
                <View style={styles.pinBox}>
                  <RcIconVectorCC color={colors2024['neutral-title-1']} />
                  <Text style={styles.headerText}>
                    {t('page.nextComponent.multiAddressHome.pin')}
                  </Text>
                </View>
                <View />
              </View>
              <View style={[styles.pinGrid]}>
                {pinAccountsFirstFour.map((item, index) => {
                  return item ? (
                    <TouchableOpacity
                      style={StyleSheet.flatten([styles.pinGridItem])}
                      key={index}
                      onPress={() => {
                        handleClickPinAccount(item);
                        matomoRequestEvent({
                          category: 'Click_Pin',
                          action: `Click_${index}`,
                        });
                      }}>
                      <WalletIcon
                        type={item.brandName}
                        width={18}
                        height={18}
                        borderRadius={5}
                      />
                      <Text style={styles.pinGridText}>
                        {calcPinPercent(item.balance || 0)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      key={index}
                      style={StyleSheet.flatten([
                        styles.pinGridItem,
                        styles.emptyItem,
                      ])}
                    />
                  );
                })}
              </View>
            </>
          )}
          <View style={styles.menuHeader}>
            <Text style={styles.headerText}>
              {t('page.nextComponent.multiAddressHome.services')}
            </Text>
            {Boolean(pendingTxCount) && (
              <TouchableOpacity
                style={styles.pendingContainer}
                onPress={() => handleClickMenu(MultiHomeFeatTitle.History)}>
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}>
                  <RcPending width={14} height={14} />
                </Animated.View>
                <Text style={styles.pendingText}>{`${pendingTxCount} ${t(
                  'page.bridge.Pending',
                )}`}</Text>
                <RcIconOrangeArrow />
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.grid]}>
            {MENU_ARR.map((el, index) => {
              return (
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.gridItem,
                    { width: itemWidth },
                  ])}
                  key={index}
                  onPress={e => {
                    handleClickMenu(el.title);
                    matomoRequestEvent({
                      category: 'Click_Services',
                      action: `Click_${el.title}`,
                    });
                  }}>
                  <View style={styles.iconWrapper}>
                    <el.icon />
                    {!!el.badge && el.badge > 0 && (
                      <BadgeText count={el.badge} style={styles.badgeStyle} />
                    )}
                  </View>
                  <Text style={styles.gridText}>
                    {el.title === MultiHomeFeatTitle.Dapps && IS_IOS
                      ? 'Websites'
                      : el.title}
                  </Text>
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
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
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
  rootScreenContainer: {
    // ...makeDebugBorder(),
    // paddingHorizontal: 20,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBox: {
    height: ScreenLayouts.headerAreaHeight,
    // paddingLeft: 8,
    // paddingRight: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    // flex: 1,
    // backgroundColor: colors2024['neutral-title-1'],
  },
  balanceTextBox: {
    marginRight: 12,
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  balanceBox: {
    paddingHorizontal: 4,
    marginTop: 10,
    marginBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  menuHeader: {
    height: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginHorizontal: 4,
    margin: 12,
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
    width: 20,
    height: 20,
    lineHeight: 20,
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
    marginBottom: 20,
  },
  emptyItem: {
    backgroundColor: 'transparent',
  },
  pinGridItem: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 10,
    flexShrink: 0,
    flex: 1,
    // padding: 10,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    gap: 8,
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    gap: ITEM_GRID_GAP,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 20,
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
    height: 100,
    gap: 12,
    position: 'relative',
  },
  pendingContainer: {
    flexDirection: 'row',
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-4'],
    borderColor: colors2024['orange-disable'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 0,
  },
  pendingText: {
    marginLeft: 2,
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default MultiAddressHome;
