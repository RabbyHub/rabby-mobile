/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractProject } from '@/screens/Home/types';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS_ENUM } from '@debank/common';
import { preferenceService } from '@/core/services';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { TokenChartRef, TokenPriceChart } from './components/TokenPriceChart';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { formatTokenAmount } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenChainAndContract } from './components/TokenChainAndContract';
import { IssuerAndListSite } from './components/IssuerAndListSite';
import RcIconWarningCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { useAtom, useSetAtom } from 'jotai';
import { isFromBackAtom } from '../Swap/hooks/atom';
import {
  fetchTokenPriceData,
  useSingleTokenBalance,
  useTokenMarketInfo,
} from './hook';
import { RightMore } from './components/RightMore';
import HeaderBalanceCard from './components/HeaderBalanceCard';
import { navigateDeprecated } from '@/utils/navigation';
import { Tabs } from 'react-native-collapsible-tab-view';
import { DynamicCustomMaterialTabBar } from './components/CustomTabBar';
import CustomLabel from './components/CustomLabel';
import { CandlePeriod } from '@/components2024/TradingViewCandleChart/type';
import TradingViewCandleChart, {
  TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import TimePanel from './components/TimePanel';
import MarketInfo from './components/MarketInfo';
import { atomByMMKV } from '@/core/storage/mmkv';
import ActivityAndHolders from './components/Market/ActivityAndHolders';
import { scrollEndCallBack } from './components/Market/hooks';
import { every10sEvent, useEvery10sEvent } from './event';
import { ITokenItem } from '@/store/tokens';

const currentIntervalAtom = atomByMMKV<CandlePeriod>(
  '@tokenDetail.currentInterval',
  CandlePeriod.ONE_MINUTE,
);

const isAndroid = Platform.OS === 'android';

export type TokenFromAddressItem = {
  address: string;
  amountStr: string;
  amount: number;
  type: KEYRING_TYPE;
  aliasName: string;
};

export type RelatedDeFiType = AbstractProject & {
  amount: number;
  address: string;
};

const { width: screenWidth } = Dimensions.get('window');

export const RiskTokenTips = ({ isDanger }: { isDanger?: boolean }) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  return isDanger ? (
    <View style={styles.searchTokenDanger}>
      <View style={styles.tokenRowContent}>
        <RcIconWarningCC
          width={14}
          height={14}
          color={colors2024['red-default']}
        />
        <Text style={styles.searchTokenDangerText}>
          {t('page.search.tokenItem.verifyDangerTips')}
        </Text>
      </View>
    </View>
  ) : (
    <View style={styles.searchTokenWarning}>
      <View style={styles.tokenRowContent}>
        <RcIconWarningCC
          width={14}
          height={14}
          color={colors2024['orange-default']}
        />
        <Text style={styles.searchTokenWarningText}>
          {t('page.search.tokenItem.scamWarningTips')}
        </Text>
      </View>
    </View>
  );
};

export const TokenMarketInfoScreen = () => {
  const route =
    useRoute<GetRootScreenNavigationProps<'TokenMarketInfo'>['route']>();
  const { token, account, tokenSelectType } = route.params || {};
  console.log('token', token);
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle,
  });

  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { safeOffHeader } = useSafeSizes();
  const { list: accounts } = useAccountInfo();

  const { safeOffBottom } = useSafeSizes();

  const finalAccount = useMemo(() => {
    return account || accounts[0] || preferenceService.getFallbackAccount();
  }, [account, accounts]);

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();

  const {
    data: tokenWithAmount,
    refreshAsync,
    loading: tokenWithAmountLoading,
  } = useRequest(
    async () => {
      const res = await openapi.getToken(
        finalAccount!.address,
        token.chain,
        token.id,
      );
      return {
        ...token,
        price_24h_change: res?.price_24h_change,
        usd_value: res?.usd_value,
        price: res?.price,
        support_market_data: res?.support_market_data,
      } as ITokenItem;
    },
    {
      refreshDeps: [token.chain, token.id, finalAccount?.address],
    },
  );

  const {
    data: tokenEntity,
    loading: entityLoading,
    refreshAsync: refreshTokenEntity,
  } = useRequest(
    async () => {
      if (!token || !token.id) {
        return;
      }

      const res = await openapi.getTokenEntity(token.id, token.chain);
      return res;
    },
    {
      refreshDeps: [token.id, token.chain],
    },
  );

  const { tokenRefresh, singleTokenRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    singleTokenRefresh();
    tokenRefresh();
  }, [singleTokenRefresh, tokenRefresh]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea
        style={{ marginLeft: -3 }}
        key={finalAccount?.address}
        token={token}
        showCopyIcon
      />
    );
  }, [finalAccount?.address, token]);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={() =>
          finalAccount?.address &&
          apisAddressBalance.triggerUpdate({
            address: finalAccount?.address,
            force: false,
            fromScene: 'TokenDetail',
          })
        }
        isMultiAddress={false}
        refreshTags={refreshTag}
        unHold
      />
    );
  }, [token, refreshTag, finalAccount?.address]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // 页面失焦（返回/左滑/点击返回按钮）时统一副作用
        setIsFromBack(true);
      };
    }, [setIsFromBack]),
  );

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
      headerTitleAlign: 'left',
    });
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle]);

  const isFromSwap =
    !!tokenSelectType && ['swapTo', 'swapFrom'].includes(tokenSelectType);
  const isSwapTo = useMemo(
    () => tokenSelectType === 'swapTo',
    [tokenSelectType],
  );
  const isBridgeTo = useMemo(
    () => tokenSelectType === 'bridgeTo',
    [tokenSelectType],
  );
  const isTransactionTo = useMemo(
    () => isSwapTo || isBridgeTo,
    [isBridgeTo, isSwapTo],
  );

  const handleSwap = useMemoizedFn(
    async (
      type: 'Buy' | 'Sell',
      address?: string,
      accountType?: KEYRING_TYPE,
    ) => {
      const chain = findChain({
        serverId: token.chain,
      });

      const toAccount =
        address && accountType
          ? accounts.find(
              i => isSameAddress(address, i.address) && i.type === accountType,
            ) || finalAccount
          : finalAccount;
      await switchSceneCurrentAccount('MakeTransactionAbout', toAccount);
      // 关闭弹窗隐藏
      setIsFromBack(false);
      navigation.push(RootNames.StackTransaction, {
        screen: account ? RootNames.Swap : RootNames.MultiSwap,
        params: {
          chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
          tokenId: token?.id,
          type: tokenSelectType === 'swapTo' ? 'Buy' : type,
          address,
          isFromSwap,
        },
      });
    },
  );

  const handleBridgeTo = useMemoizedFn(
    async (address?: string, accountType?: KEYRING_TYPE) => {
      const chain = findChain({
        serverId: token.chain,
      });

      const toAccount =
        address && accountType
          ? accounts.find(
              i => isSameAddress(address, i.address) && i.type === accountType,
            ) || finalAccount
          : finalAccount;
      await switchSceneCurrentAccount('MakeTransactionAbout', toAccount);
      // 关闭弹窗隐藏
      setIsFromBack(false);
      navigation.push(RootNames.StackTransaction, {
        screen: account ? RootNames.Bridge : RootNames.MultiBridge,
        params: {
          toChainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
          toTokenId: token?.id,
        },
      });
    },
  );

  const { amountSum, usdValue, percentChange, isLoss, is24hNoChange } =
    useSingleTokenBalance({
      token,
    });

  const { t } = useTranslation();

  const handleOpenTokenDetail = useCallback(() => {
    navigateDeprecated(RootNames.TokenDetail, {
      ...route.params,
    });
  }, [route.params]);

  const externalContent = useMemo(() => {
    return (
      <ImageBackground
        source={
          !isLoss
            ? require('@/assets2024/images/detail/detail-bg-up.png')
            : require('@/assets2024/images/detail/detail-bg-loss.png')
        }
        resizeMode="cover"
        style={{
          position: 'absolute',
          top: -120, // 向上偏移120px，这样图片的底部30px会显示在容器内
          left: 0,
          width: screenWidth,
          height: 150,
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
          zIndex: -100,
        }}
      />
    );
  }, [colors2024, isLight, isLoss]);

  const renderTabBar = React.useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        initialTabItemsLayout={[
          {
            x: 20,
            width: 100,
          },
          {
            x: 120,
            width: 120,
          },
        ]}
        initPaddingLeft={styles.tabsBarContainer?.paddingLeft ?? 0}
        externalContent={externalContent}
      />
    ),
    [externalContent, styles.indicator, styles.tabBar, styles.tabsBarContainer],
  );

  const riskInfo = useMemo(() => {
    const hasRisk = token.is_verified === false || token.is_suspicious;
    const isDanger = token.is_verified === false;
    return {
      hasRisk,
      isDanger,
      content: hasRisk ? (
        <View style={styles.riskContainer}>
          <RiskTokenTips isDanger={isDanger} />
        </View>
      ) : null,
      securityContent: hasRisk ? (
        <RcIconWarningCC
          width={14}
          height={14}
          color={
            isDanger ? colors2024['red-default'] : colors2024['orange-default']
          }
        />
      ) : null,
    };
  }, [
    colors2024,
    styles.riskContainer,
    token.is_suspicious,
    token.is_verified,
  ]);

  const renderMarketDataLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.tokenDetail.tabs.marketData')}
      />
    ),
    [t],
  );

  const renderTokenSecurityLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.tokenDetail.tabs.tokenSecurity')}
        icon={riskInfo.securityContent}
      />
    ),
    [riskInfo.securityContent, t],
  );

  const tokenPriceChartRef = React.useRef<TokenChartRef>(null);
  const chartWebViewRef = React.useRef<TradingViewChartRef>(null);
  const [currentInterval, setCurrentInterval] = useAtom(currentIntervalAtom);

  const [loading, setLoading] = useState(true);
  const handleRefresh = useCallback(() => {
    refreshTokenEntity();
    refreshAsync();
    tokenPriceChartRef.current?.refreshChart();
  }, [refreshAsync, refreshTokenEntity]);

  const { marketInfo, holdInfo, supplyInfo } = useTokenMarketInfo({
    chain: token.chain,
    tokenId: token.id,
  });

  const handleChangeInterval = useCallback(
    (interval: CandlePeriod) => {
      setCurrentInterval(interval);
      fetchTokenPriceData(
        {
          chain: token.chain,
          tokenId: token.id,
        },
        interval,
      ).then(res => {
        chartWebViewRef.current?.setData(res);
      });
    },
    [setCurrentInterval, token.id, token.chain],
  );
  const handleScroll = useCallback(event => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 20) {
      scrollEndCallBack?.cb?.();
    }
  }, []);

  const handleRefreshChart = useCallback(() => {
    if (!tokenWithAmount?.support_market_data) {
      return;
    }
    fetchTokenPriceData(
      {
        chain: token.chain,
        tokenId: token.id,
      },
      currentInterval,
      Math.floor(Date.now() / 1000),
    ).then(res => {
      res.candles[0] &&
        chartWebViewRef.current?.updateCandleData(res.candles[0]);
    });
  }, [
    currentInterval,
    token.id,
    token.chain,
    tokenWithAmount?.support_market_data,
  ]);

  useEvery10sEvent();

  useEffect(() => {
    return every10sEvent.on(() => {
      refreshTokenEntity();
      refreshAsync();
      handleRefreshChart();
    });
  }, [handleRefresh, handleRefreshChart, refreshAsync, refreshTokenEntity]);

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <ImageBackground
        source={
          !isLoss
            ? require('@/assets2024/images/detail/detail-bg-up.png')
            : require('@/assets2024/images/detail/detail-bg-loss.png')
        }
        resizeMode="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: safeOffHeader + 10,
        }}
      />

      <Tabs.Container
        renderTabBar={renderTabBar}
        tabBarHeight={30}
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}
        pagerProps={{ scrollEnabled: !isAndroid }}>
        <Tabs.Tab label={renderMarketDataLabel} name="marketData">
          <ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={200}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} />
            }
            style={styles.innerContainer}>
            {!!account && (
              <HeaderBalanceCard
                amount={formatTokenAmount(amountSum)}
                usdValue={usdValue}
                percentChange={percentChange}
                isLoss={isLoss}
                is24hNoChange={is24hNoChange}
                style={styles.headerBalanceCard}
                onPress={handleOpenTokenDetail}
              />
            )}
            <View
              style={{
                position: 'relative',
                marginTop: 12,
              }}>
              {tokenWithAmountLoading && !tokenWithAmount ? (
                <View style={styles.skeleton} />
              ) : tokenWithAmount?.support_market_data ? (
                <>
                  <MarketInfo
                    price={tokenWithAmount?.price ?? 0}
                    price24hChange={tokenWithAmount?.price_24h_change ?? 0}
                    marketCap={
                      supplyInfo?.market_cap_usd_value?.toString() ?? ''
                    }
                    totalSupply={supplyInfo?.total_supply?.toString() ?? ''}
                    volume24h={
                      marketInfo?.market?.volume_usd_value_24h?.toString() ?? ''
                    }
                    txns24h={marketInfo?.market?.txns_24h?.toString() ?? ''}
                    holders={holdInfo?.holder_count?.toString() ?? ''}
                  />
                  <TimePanel
                    currentInterval={currentInterval}
                    onSelect={handleChangeInterval}
                  />
                  <TradingViewCandleChart
                    ref={chartWebViewRef}
                    height={300}
                    style={[
                      styles.klineContainer,
                      {
                        opacity: loading ? 0.01 : 1,
                      },
                    ]}
                    onChartReady={() => {
                      setLoading(false);
                      fetchTokenPriceData(
                        {
                          chain: token.chain,
                          tokenId: token.id,
                        },
                        currentInterval,
                      ).then(res => {
                        chartWebViewRef.current?.setData(res);
                      });
                    }}
                  />
                </>
              ) : (
                <TokenPriceChart
                  ref={tokenPriceChartRef}
                  token={tokenWithAmount || token}
                  amountList={[]}
                  relateDefiList={[]}
                />
              )}
            </View>
            <ActivityAndHolders
              hideActivity={!tokenWithAmount?.support_market_data}
              tokenId={token.id}
              chainId={token.chain}
              symbol={token.symbol}
            />
            <View style={{ height: isAndroid ? 200 + safeOffBottom : 156 }} />
          </ScrollView>
        </Tabs.Tab>
        <Tabs.Tab label={renderTokenSecurityLabel} name="tokenSecurity">
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} />
            }
            style={styles.innerContainer}>
            {riskInfo.content}
            <TokenChainAndContract token={token} tokenEntity={tokenEntity} />
            <IssuerAndListSite
              account={finalAccount}
              tokenEntity={tokenEntity}
              entityLoading={entityLoading}
            />
            <View style={{ height: isAndroid ? 200 + safeOffBottom : 156 }} />
          </ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 50 + safeOffBottom },
        ]}>
        {isTransactionTo ? (
          <Button
            title={t('global.Confirm')}
            containerStyle={StyleSheet.flatten([styles.btnContainer])}
            onPress={() => {
              if (isSwapTo) {
                handleSwap('Buy', finalAccount?.address, finalAccount?.type);
                return;
              }
              if (isBridgeTo) {
                handleBridgeTo(finalAccount?.address, finalAccount?.type);
                return;
              }
            }}
            buttonStyle={styles.btnInnerContainer}
          />
        ) : (
          <>
            <Button
              type="ghost"
              title={t('page.tokenDetail.action.Buy')}
              containerStyle={StyleSheet.flatten([styles.btnContainer])}
              buttonStyle={[styles.btnInnerContainer, styles.ghostBtn]}
              onPress={() =>
                handleSwap('Buy', finalAccount?.address, finalAccount?.type)
              }
            />
            <View style={styles.btnContainer}>
              <Button
                title={t('page.tokenDetail.action.Sell')}
                containerStyle={StyleSheet.flatten([styles.btnContainer])}
                onPress={() =>
                  handleSwap('Sell', finalAccount?.address, finalAccount?.type)
                }
                buttonStyle={styles.btnInnerContainer}
              />
            </View>
          </>
        )}
      </View>
    </NormalScreenContainer2024>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    rootScreenContainer: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
    },

    riskContainer: {
      paddingHorizontal: 20,
      marginTop: 12,
    },
    container: {
      flex: 1,
    },
    innerContainer: {
      height: '100%',
      paddingTop: 30,
    },
    buttonGroup: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      width: '100%',
      position: 'absolute',
      bottom: 0,
      // display: 'flex',
      gap: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 50,
    },

    btnContainer: {
      flex: 1,
    },

    ghostBtn: {
      // borderWidth: 1.5,
      backgroundColor: colors2024['brand-light-1'],
    },
    btnInnerContainer: {
      borderRadius: 12,
    },
    searchTokenDanger: {
      flex: 1,
      justifyContent: 'center',
      flexDirection: 'row',
      width: '100%',
      padding: 8,
      backgroundColor: colors2024['red-light-1'],
      borderRadius: 8,
      // marginTop: 12,
    },
    tokenRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    searchTokenWarning: {
      flex: 1,
      justifyContent: 'center',
      flexDirection: 'row',
      width: '100%',
      padding: 8,
      backgroundColor: colors2024['orange-light-1'],
      borderRadius: 8,
      // marginTop: 12,
    },

    searchTokenWarningText: {
      color: colors2024['orange-default'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    searchTokenDangerText: {
      color: colors2024['red-default'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    headerBalanceCard: {
      marginTop: 12,
      marginHorizontal: 18,
    },
    tabBarWrap: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors2024['neutral-line'],
    },
    tabBar: {
      height: 30,
      width: 'auto',
      flexShrink: 0,
      flex: 0,
      paddingHorizontal: 0,
      marginRight: 20,
    },
    tabsBarContainer: {
      display: 'flex',
      paddingLeft: 20,
      position: 'relative',
      height: 30,
      overflow: 'hidden',
    },
    indicator: {
      backgroundColor: colors2024['neutral-body'],
      height: 4,
      borderRadius: 100,
    },
    skeleton: {
      marginTop: 12,
      width: screenWidth - 32,
      height: 200,
      borderRadius: 12,
      marginHorizontal: 16,
    },
    klineContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
  };
});
