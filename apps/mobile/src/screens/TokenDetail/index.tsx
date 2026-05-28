/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useDebounceFn, useRequest } from 'ahooks';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  ImageBackground,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { formatPrice } from '@/utils/number';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenDetailHistoryList } from './components/HistoryList';
import { isFromBackAtom } from '../Swap/hooks/atom';
import BalanceOverview from './components/BalanceOverview';
import { useSingleTokenBalance } from './hook';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { RightMore } from './components/RightMore';
import { useSetAtom } from 'jotai';
import { TokenDetailBottomBtns } from './components/BottomBtns';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import {
  ScreenSceneAccountProvider,
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { AccountSwitcher } from './components/InScreenSwitch';
import RcIconRightArrowCC from '@/assets2024/icons/copyTrading/IconRightCC.svg';
import { patchSingleToken } from '@/databases/sync/token';
import { BG_FULL_HEIGHT } from '../Home/hooks/useBgSize';
import { Tabs } from 'react-native-collapsible-tab-view';
import { ITokenItem } from '@/store/tokens';
import { Text } from '@/components/Typography';
import { IconRightCC } from './components/IconRightCC';
import { TokenDetailWalletCard } from './components/TokenDetailWalletCard';
export type { RelatedDeFiType, TokenFromAddressItem } from './types';

const isAndroid = Platform.OS === 'android';
const ScreenWidth = Dimensions.get('window').width;

const TokenDetailContent = () => {
  const route =
    useRoute<GetRootScreenNavigationProps<'TokenDetail'>['route']>();
  const { token, account, tokenSelectType } = route.params || {};
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  const setIsFromBack = useSetAtom(isFromBackAtom);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'TokenDetail',
  });
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  useEffect(() => {
    if (account) {
      switchSceneCurrentAccount('TokenDetail', account);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [acceptSceneAccount, setAcceptSceneAccount] = React.useState(false);
  const currentAccountIdentity = React.useMemo(() => {
    if (!currentAccount) {
      return undefined;
    }
    return [
      currentAccount.address.toLowerCase(),
      currentAccount.brandName,
      currentAccount.type,
    ].join('-');
  }, [currentAccount]);
  const prevSceneAccountIdentityRef = React.useRef<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (
      prevSceneAccountIdentityRef.current !== undefined &&
      prevSceneAccountIdentityRef.current !== currentAccountIdentity
    ) {
      setAcceptSceneAccount(true);
    }
    prevSceneAccountIdentityRef.current = currentAccountIdentity;
  }, [currentAccountIdentity]);

  const shouldUseSceneAccount =
    !!currentAccount &&
    (acceptSceneAccount ||
      (!!account && isSameAccount(account, currentAccount)));

  const effectiveAccount = shouldUseSceneAccount
    ? currentAccount
    : account || currentAccount;

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const fetchBaseTokenInfo = useCallback(async () => {
    const res = await openapi.getToken(
      effectiveAccount?.address!,
      token.chain,
      token.id,
    );
    patchSingleToken(effectiveAccount?.address!, res);

    return {
      ...token,
      amount: res?.amount,
      price_24h_change: res?.price_24h_change,
      usd_value: res?.usd_value,
      price: res?.price,
    } as ITokenItem;
  }, [effectiveAccount?.address, token]);

  const { data: baseTokenInfo, refreshAsync: refreshBaseTokenInfo } =
    useRequest(fetchBaseTokenInfo, {
      manual: true,
    });

  const {
    run: runDebouncedRefreshBaseTokenInfo,
    cancel: cancelDebouncedRefreshBaseTokenInfo,
  } = useDebounceFn(
    () => {
      if (!effectiveAccount?.address) {
        return;
      }
      return refreshBaseTokenInfo();
    },
    { wait: 200 },
  );

  useEffect(() => {
    if (effectiveAccount?.address) {
      runDebouncedRefreshBaseTokenInfo();
    }

    return () => {
      cancelDebouncedRefreshBaseTokenInfo();
    };
  }, [
    cancelDebouncedRefreshBaseTokenInfo,
    effectiveAccount?.address,
    runDebouncedRefreshBaseTokenInfo,
    token.chain,
    token.id,
  ]);

  const { tokenRefresh, singleTokenRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    singleTokenRefresh();
    tokenRefresh();
  }, [singleTokenRefresh, tokenRefresh]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea
        style={{ marginLeft: isAndroid ? 0 : -30 }}
        key={effectiveAccount?.address}
        tokenSize={33}
        chainSize={15}
        borderChain
        token={token}
        showCopyIcon
      />
    );
  }, [effectiveAccount?.address, token]);

  const handleOpenTokenMarketInfo = useCallback(() => {
    navigateDeprecated(RootNames.TokenMarketInfo, {
      ...route.params,
      token: baseTokenInfo || token,
      account: effectiveAccount,
    });
  }, [baseTokenInfo, effectiveAccount, route.params, token]);

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={() =>
          effectiveAccount?.address &&
          apisAddressBalance.triggerUpdate({
            address: effectiveAccount?.address,
            force: false,
            fromScene: 'TokenDetail',
          })
        }
        isMultiAddress={false}
        refreshTags={refreshTag}
      />
    );
  }, [effectiveAccount?.address, refreshTag, token]);

  useFocusEffect(
    useCallback(() => {
      if (effectiveAccount?.address) {
        runDebouncedRefreshBaseTokenInfo();
      }

      return () => {
        cancelDebouncedRefreshBaseTokenInfo();
        // 页面失焦（返回/左滑/点击返回按钮）时统一副作用
        setIsFromBack(true);
      };
    }, [
      cancelDebouncedRefreshBaseTokenInfo,
      effectiveAccount?.address,
      runDebouncedRefreshBaseTokenInfo,
      setIsFromBack,
    ]),
  );

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
      headerTitleAlign: 'left',
    });
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle]);

  const {
    amountSum,
    usdValue,
    percentChange,
    has24hChangeData,
    isLoss,
    is24hNoChange,
    price,
  } = useSingleTokenBalance({
    token: baseTokenInfo || token,
  });

  const onRefresh = useCallback(async () => {
    refreshBaseTokenInfo();
  }, [refreshBaseTokenInfo]);
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.balanceOverviewContainer}>
        <AccountSwitcher forScene="TokenDetail" disableSwitch={false} />
        <View style={styles.balanceOverviewContent}>
          <BalanceOverview usdValue={usdValue} amount={amountSum || 0} />
          {!baseTokenInfo ? null : (
            <Pressable
              style={[
                styles.floatingBarContent,
                has24hChangeData
                  ? [
                      isLoss ? styles.lossShadow : styles.upShadow,
                      {
                        borderColor: is24hNoChange
                          ? colors2024['neutral-bg-5']
                          : isLoss
                          ? colors2024['red-disable']
                          : colors2024['green-light-2'],
                        backgroundColor: is24hNoChange
                          ? colors2024['neutral-bg-1']
                          : isLoss
                          ? colors2024['red-light-1']
                          : colors2024['green-light-1'],
                      },
                    ]
                  : styles.marketDataBarContent,
              ]}
              onPress={handleOpenTokenMarketInfo}>
              {has24hChangeData ? (
                <>
                  <View style={styles.floatPriceContainer}>
                    <Text
                      style={[
                        styles.floatBalanceTitle,
                        is24hNoChange ? styles.noChangePriceChange : undefined,
                      ]}>
                      {t('page.tokenDetail.price')}:
                    </Text>
                    <Text style={styles.floatPrice}>
                      {price ? `${formatPrice(price)}` : ' --'}
                    </Text>
                  </View>
                  <View style={styles.floatBalanceContainer}>
                    <Text
                      style={[
                        styles.floatPriceChange,
                        is24hNoChange
                          ? styles.noChangePriceChange
                          : isLoss
                          ? styles.redPriceChange
                          : styles.greenPriceChange,
                      ]}>
                      {is24hNoChange ? '' : isLoss ? '-' : '+'}
                      {percentChange}
                    </Text>
                    {is24hNoChange ? (
                      <IconRightCC
                        width={14}
                        height={14}
                        rectColor={colors2024['neutral-line']}
                        pathColor={colors2024['neutral-title-1']}
                      />
                    ) : (
                      <RcIconRightArrowCC
                        width={14}
                        height={14}
                        color={
                          isLoss
                            ? colors2024['red-default']
                            : colors2024['green-default']
                        }
                      />
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.marketDataContainer}>
                  <Text style={styles.marketDataText}>
                    {t('page.tokenDetail.tabs.marketData')}
                  </Text>
                  <View style={styles.marketDataIconContainer}>
                    <IconRightCC
                      width={14}
                      height={14}
                      rectColor={colors2024['neutral-line']}
                      pathColor={colors2024['neutral-title-1']}
                    />
                  </View>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {effectiveAccount ? (
          <TokenDetailWalletCard account={effectiveAccount} />
        ) : null}

        <View style={[styles.historyHeader]}>
          <Text style={styles.relateTitle}>
            {t('page.tokenDetail.Transaction')}
          </Text>
        </View>
      </View>
    );
  }, [
    amountSum,
    baseTokenInfo,
    colors2024,
    effectiveAccount,
    handleOpenTokenMarketInfo,
    has24hChangeData,
    is24hNoChange,
    isLoss,
    percentChange,
    price,
    styles,
    t,
    usdValue,
  ]);

  const handleReachTopStatusChange = React.useCallback(
    (status: boolean) => {
      Animated.timing(fadeAnim, {
        toValue: status ? 1 : 0,
        duration: 10,
        useNativeDriver: true,
      }).start();
    },
    [fadeAnim],
  );

  if (!effectiveAccount?.address) {
    return null;
  }

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <Animated.View
        style={[
          styles.topWrapper,
          {
            height: BG_FULL_HEIGHT,
            opacity: fadeAnim,
          },
        ]}>
        <ImageBackground
          source={
            !isLoss
              ? require('@/assets2024/singleHome/up.png')
              : require('@/assets2024/singleHome/loss.png')
          }
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: BG_FULL_HEIGHT,
          }}
        />
      </Animated.View>
      <Tabs.Container
        renderTabBar={() => null}
        tabBarHeight={0}
        headerHeight={260}
        renderHeader={renderHeader}
        headerContainerStyle={styles.headerContainer}
        containerStyle={styles.container}
        pagerProps={{ scrollEnabled: !isAndroid }}>
        <Tabs.Tab label="History" name="history">
          <TokenDetailHistoryList
            onRefresh={onRefresh}
            onReachTopStatusChange={handleReachTopStatusChange}
            finalAccount={effectiveAccount}
            token={token}
          />
        </Tabs.Tab>
      </Tabs.Container>

      <View style={styles.bottomContainer}>
        <TokenDetailBottomBtns
          token={token}
          finalAccount={effectiveAccount}
          tokenSelectType={tokenSelectType}
        />
      </View>
      <AccountSwitcherModal token={token} forScene="TokenDetail" inScreen />
    </NormalScreenContainer2024>
  );
};

export const TokenDetailScreen = () => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'TokenDetail',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'TokenDetail',
        ofScreen: 'TokenDetail',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-TokenDetail`,
      }}>
      <TokenDetailContent />
    </ScreenSceneAccountProvider>
  );
};

const getStyle = createGetStyles2024(ctx => {
  const { colors2024, isLight, safeAreaInsets } = ctx;
  return {
    rootScreenContainer: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingBottom: 20,
    },
    topWrapper: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: ScreenWidth,
      overflow: 'hidden',
    },
    headerContainer: {
      backgroundColor: 'transparent',
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    container: {
      overflow: 'hidden',
    },
    balanceOverviewContainer: {
      paddingLeft: 12,
      paddingRight: 12,
    },
    headerRightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerAccountSwitcher: {
      marginRight: 12,
    },
    bottomContainer: {
      width: '100%',
      height:
        BOTTOM_BUTTON_TOP_OFFSET +
        BOTTOM_BUTTON_DOUBLE_HEIGHT +
        getBottomButtonBottomOffset(safeAreaInsets.bottom),
      backgroundColor: colors2024['neutral-bg-1'],
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    balanceOverviewContent: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      paddingLeft: 5,
      paddingRight: 9,
    },
    floatingBarContent: {
      flexDirection: 'column',
      gap: 4,
      borderWidth: 1,
      borderColor: colors2024['green-default'],
      backgroundColor: colors2024['green-light-1'],
      padding: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderBottomRightRadius: 2,
    },
    marketDataBarContent: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 16,
      borderBottomRightRadius: 2,
    },
    upShadow: {
      ...Platform.select({
        ios: {
          shadowColor: 'rgb(88, 198, 105)',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.04,
          shadowRadius: 29,
        },
      }),
    },
    lossShadow: {
      ...Platform.select({
        ios: {
          shadowColor: 'rgb(255, 69, 58)',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.04,
          shadowRadius: 29,
        },
      }),
    },
    floatPriceContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    floatBalanceTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    floatBalanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    marketDataContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 90,
    },
    marketDataText: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    marketDataIconContainer: {
      width: 14,
      height: 14,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatPrice: {
      color: colors2024['neutral-title-1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      fontFamily: 'SF Pro Rounded',
    },
    floatPriceChange: {
      color: colors2024['neutral-title-1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      fontFamily: 'SF Pro Rounded',
    },
    noChangePriceChange: {
      color: colors2024['neutral-body'],
      fontWeight: '500',
    },
    greenPriceChange: {
      color: colors2024['green-default'],
    },
    redPriceChange: {
      color: colors2024['red-default'],
    },
    relateTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '900',
    },
    historyHeader: {
      flexDirection: 'row',
      marginTop: 0,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyHeaderTop: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
    },
  };
});
