/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken, AbstractProject } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { abstractTokenToTokenItem } from '@/utils/token';
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
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { CombineTokensItem } from '../Home/hooks/store';
import { formatTokenAmount } from '@/utils/number';
import { useAssets } from '../Search/useAssets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { ellipsisAddress } from '@/utils/address';
import BigNumber from 'bignumber.js';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenChainAndContract } from './components/TokenChainAndContract';
import { IssuerAndListSite } from './components/IssuerAndListSite';
import RcIconWarningCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useSetAtom } from 'jotai';
import { isFromBackAtom } from '../Swap/hooks/atom';
import { useTokenBalance } from './hook';
import { RightMore } from './components/RightMore';
import HeaderBalanceCard from './components/HeaderBalanceCard';
import { navigate } from '@/utils/navigation';
import { Tabs } from 'react-native-collapsible-tab-view';
import { DynamicCustomMaterialTabBar } from './components/CustomTabBar';
import CustomLabel from './components/CustomLabel';
import {
  CandleData,
  CandlePeriod,
} from '@/components2024/TradingViewCandleChart/type';
import TradingViewCandleChart, {
  TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from './components/TokenPriceChart/LoadingLinear';

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

const invalidCandleData: CandleData = {
  coin: 'BTC',
  interval: CandlePeriod.ONE_MINUTE,
  candles: [
    {
      time: 1755590400,
      open: 4233,
      high: 4315.7,
      low: 4216.8,
      close: 4307.6,
      volume: 1000000,
    },
    {
      time: 1755604800,
      open: 4307.6,
      high: 4337.8,
      low: 4166,
      close: 4189.2,
      volume: 1000000,
    },
    {
      time: 1755619200,
      open: 4189.6,
      high: 4203.7,
      low: 4112,
      close: 4140.7,
      volume: 1000000,
    },
    {
      time: 1755633600,
      open: 4140.8,
      high: 4163.1,
      low: 4065.9,
      close: 4073.7,
      volume: 1000000,
    },
    {
      time: 1755648000,
      open: 4073.8,
      high: 4156.4,
      low: 4060.1,
      close: 4138.9,
      volume: 1000000,
    },
    {
      time: 1755662400,
      open: 4138.9,
      high: 4209.7,
      low: 4137.3,
      close: 4183,
      volume: 1000000,
    },
    {
      time: 1755676800,
      open: 4182.9,
      high: 4240,
      low: 4147.2,
      close: 4192.7,
      volume: 1000000,
    },
    {
      time: 1755691200,
      open: 4192.7,
      high: 4309,
      low: 4103.7,
      close: 4253.6,
      volume: 1000000,
    },
    {
      time: 1755705600,
      open: 4253.6,
      high: 4367.5,
      low: 4253.5,
      close: 4347.2,
      volume: 1000000,
    },
    {
      time: 1755720000,
      open: 4347.3,
      high: 4380.3,
      low: 4321.9,
      close: 4337.4,
      volume: 1000000,
    },
    {
      time: 1755734400,
      open: 4337.4,
      high: 4340.9,
      low: 4277.6,
      close: 4295.3,
      volume: 1000000,
    },
    {
      time: 1755748800,
      open: 4295.1,
      high: 4322.1,
      low: 4272.2,
      close: 4311.6,
      volume: 1000000,
    },
    {
      time: 1755763200,
      open: 4311.7,
      high: 4315.4,
      low: 4257.5,
      close: 4279,
      volume: 1000000,
    },
    {
      time: 1755777600,
      open: 4278.9,
      high: 4329.7,
      low: 4230,
      close: 4246.2,
      volume: 1000000,
    },
    {
      time: 1755792000,
      open: 4246.2,
      high: 4276.7,
      low: 4211.2,
      close: 4226.7,
      volume: 1000000,
    },
    {
      time: 1755806400,
      open: 4226.5,
      high: 4264.1,
      low: 4206,
      close: 4226.5,
      volume: 1000000,
    },
    {
      time: 1755820800,
      open: 4226.5,
      high: 4318.9,
      low: 4223.4,
      close: 4282,
      volume: 1000000,
    },
    {
      time: 1755835200,
      open: 4282,
      high: 4348,
      low: 4275.2,
      close: 4330.7,
      volume: 1000000,
    },
    {
      time: 1755849600,
      open: 4330.8,
      high: 4358.3,
      low: 4275.6,
      close: 4277.4,
      volume: 1000000,
    },
    {
      time: 1755864000,
      open: 4277.4,
      high: 4676.4,
      low: 4211.6,
      close: 4618.8,
      volume: 1000000,
    },
    {
      time: 1755878400,
      open: 4618.8,
      high: 4861.7,
      low: 4618.7,
      close: 4836.3,
      volume: 1000000,
    },
    {
      time: 1755892800,
      open: 4836.7,
      high: 4891.7,
      low: 4801,
      close: 4834.8,
      volume: 1000000,
    },
    {
      time: 1755907200,
      open: 4834.7,
      high: 4835.2,
      low: 4667.5,
      close: 4698.2,
      volume: 1000000,
    },
    {
      time: 1755921600,
      open: 4698.1,
      high: 4768.5,
      low: 4697.5,
      close: 4717.5,
      volume: 1000000,
    },
    {
      time: 1755936000,
      open: 4717.6,
      high: 4750,
      low: 4695.3,
      close: 4707.8,
      volume: 1000000,
    },
    {
      time: 1755950400,
      open: 4708,
      high: 4773.1,
      low: 4696.5,
      close: 4756.4,
      volume: 1000000,
    },
    {
      time: 1755964800,
      open: 4756.4,
      high: 4765.1,
      low: 4732.5,
      close: 4762,
      volume: 1000000,
    },
    {
      time: 1755979200,
      open: 4761.9,
      high: 4802.6,
      low: 4740.8,
      close: 4782.8,
      volume: 1000000,
    },
    {
      time: 1755993600,
      open: 4782.8,
      high: 4823.8,
      low: 4757.2,
      close: 4793.1,
      volume: 1000000,
    },
    {
      time: 1756008000,
      open: 4792.7,
      high: 4804.4,
      low: 4760.3,
      close: 4762.2,
      volume: 1000000,
    },
    {
      time: 1756022400,
      open: 4762.2,
      high: 4789.8,
      low: 4724.2,
      close: 4751.3,
      volume: 1000000,
    },
    {
      time: 1756036800,
      open: 4751.3,
      high: 4833.6,
      low: 4741.9,
      close: 4802,
      volume: 1000000,
    },
    {
      time: 1756051200,
      open: 4802.1,
      high: 4960,
      low: 4671.5,
      close: 4816.9,
      volume: 1000000,
    },
    {
      time: 1756065600,
      open: 4816.9,
      high: 4826,
      low: 4709.6,
      close: 4781.5,
      volume: 1000000,
    },
    {
      time: 1756080000,
      open: 4781.5,
      high: 4799,
      low: 4670,
      close: 4727.4,
      volume: 1000000,
    },
    {
      time: 1756094400,
      open: 4727.3,
      high: 4739.2,
      low: 4577.3,
      close: 4588.6,
      volume: 1000000,
    },
    {
      time: 1756108800,
      open: 4588.6,
      high: 4612.8,
      low: 4512.8,
      close: 4596.9,
      volume: 1000000,
    },
    {
      time: 1756123200,
      open: 4596.9,
      high: 4683.1,
      low: 4582.9,
      close: 4611.8,
      volume: 1000000,
    },
    {
      time: 1756137600,
      open: 4611.9,
      high: 4645,
      low: 4412.6,
      close: 4415.4,
      volume: 1000000,
    },
    {
      time: 1756152000,
      open: 4415.4,
      high: 4443.1,
      low: 4334,
      close: 4374.7,
      volume: 1000000,
    },
    {
      time: 1756166400,
      open: 4374.7,
      high: 4450,
      low: 4310.8,
      close: 4402.9,
      volume: 1000000,
    },
    {
      time: 1756180800,
      open: 4402.9,
      high: 4454.9,
      low: 4394.6,
      close: 4429.9,
      volume: 1000000,
    },
    {
      time: 1756195200,
      open: 4429.7,
      high: 4447.8,
      low: 4404.8,
      close: 4416,
      volume: 1000000,
    },
  ],
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
    useRoute<GetRootScreenNavigationProps<'TokenDetail'>['route']>();
  const {
    fromPortfolio,
    token: _token,
    account,
    needUseCacheToken,
    unHold: _unHold,
    isSingleAddress,
    tokenSelectType,
    rawPortfolios, // only isSingleAddress === true can use
  } = route.params || {};

  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle,
  });

  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { safeOffHeader } = useSafeSizes();
  const { assetsMap, getCacheTop10Assets, getTokenCombined } = useAssets({
    hideCombined: true,
  });

  const token: AbstractPortfolioToken | CombineTokensItem = useMemo(() => {
    if (fromPortfolio || needUseCacheToken) {
      const combinedToken = getTokenCombined(_token._tokenId, _token.chain);
      return combinedToken?.[0] || _token;
    }
    return _token;
  }, [getTokenCombined, _token, needUseCacheToken, fromPortfolio]);
  const { safeOffBottom } = useSafeSizes();
  const { top10Addresses, list: accounts } = useAccountInfo();

  const finalAccount =
    account || accounts[0] || preferenceService.getFallbackAccount();

  const { data: tokenEntityList } = useRequest(
    async () => {
      if (!token || !token._tokenId || !top10Addresses.length) {
        return [];
      }

      return await TokenItemEntity.batchMultiAddressTokensByIdAndChain(
        isSingleAddress
          ? [finalAccount!.address.toLowerCase()]
          : top10Addresses.map(item => item.toLowerCase()),
        token.chain,
        token._tokenId,
      );
    },
    {
      refreshDeps: [
        token.chain,
        token._tokenId,
        top10Addresses,
        isSingleAddress,
        finalAccount?.address,
      ],
    },
  );

  const relateDefiList = useMemo(() => {
    const resList = [] as RelatedDeFiType[];
    if (isSingleAddress && rawPortfolios && rawPortfolios.length) {
      rawPortfolios?.forEach(portfolio => {
        if (portfolio.chain !== token.chain) {
          return;
        }

        let amount = 0;
        const { _portfolios } = portfolio;
        _portfolios?.forEach(portfolioItem => {
          const { _tokenList } = portfolioItem;

          const sameItem = _tokenList.find(
            item => item._tokenId === token._tokenId,
          );
          if (sameItem) {
            amount += sameItem.amount;
          }
        });

        amount &&
          resList.push({
            ...portfolio,
            amount,
            address: finalAccount.address,
          });
      });
      return resList;
    }

    Object.keys(assetsMap).map(address => {
      if (isSingleAddress && !isSameAddress(address, finalAccount!.address)) {
        return;
      }

      if (
        !isSingleAddress &&
        accounts.findIndex(item => isSameAddress(item.address, address)) < 0
      ) {
        // filter watch address not in myaccounts
        return;
      }

      const { portfolios } = assetsMap[address];
      portfolios?.map(portfolio => {
        if (portfolio.chain !== token.chain) {
          return;
        }

        let amount = 0;
        const { _portfolios } = portfolio;
        _portfolios?.map(portfolioItem => {
          const { _tokenList } = portfolioItem;

          const sameItem = _tokenList.find(
            item => item._tokenId === token._tokenId,
          );
          if (sameItem) {
            amount += sameItem.amount;
          }
        });

        amount &&
          resList.push({
            ...portfolio,
            amount,
            address,
          });
      });
    });
    return resList;
  }, [
    token,
    assetsMap,
    isSingleAddress,
    finalAccount,
    accounts,
    rawPortfolios,
  ]);

  useEffect(() => {
    const id = setTimeout(() => {
      getCacheTop10Assets({
        disableNFT: true,
        disableToken: true,
      });
    }, 200);
    return () => {
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();

  const { data: tokenWithAmount, refreshAsync } = useRequest(
    async () => {
      const res = await openapi.getToken(
        finalAccount!.address,
        token.chain,
        token._tokenId,
      );
      return ensureAbstractPortfolioToken({
        ...abstractTokenToTokenItem(token),
        price_24h_change: res?.price_24h_change,
        usd_value: res?.usd_value,
        price: res?.price,
      });
    },
    {
      refreshDeps: [token.chain, token._tokenId, finalAccount?.address],
    },
  );

  const {
    data: tokenEntity,
    loading: entityLoading,
    refreshAsync: refreshTokenEntity,
  } = useRequest(
    async () => {
      if (!token || !token._tokenId) {
        return;
      }

      const res = await openapi.getTokenEntity(token._tokenId, token.chain);
      return res;
    },
    {
      refreshDeps: [token._tokenId, token.chain],
    },
  );

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { tokenRefresh, singleTokenRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    if (isSingleAddress) {
      singleTokenRefresh();
    }
    tokenRefresh();
  }, [isSingleAddress, singleTokenRefresh, tokenRefresh]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea
        style={{ marginLeft: -3 }}
        key={finalAccount?.address}
        token={token}
      />
    );
  }, [finalAccount?.address, token]);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const tokenFromAddress = useMemo(() => {
    const res = [] as TokenFromAddressItem[];
    if (isSingleAddress && token.amount) {
      const dbToken = tokenEntityList?.find(item =>
        isSameAddress(item.owner_addr, finalAccount!.address),
      );
      const amount = dbToken?.amount || token.amount;
      res.push({
        ...token,
        amountStr: formatTokenAmount(amount),
        amount,
        address: finalAccount!.address,
        type: finalAccount!.type,
        aliasName:
          finalAccount!.aliasName || ellipsisAddress(finalAccount!.address),
      });
      return res;
    } else {
      const { fromAddress } = token as CombineTokensItem;

      const fromAddressList =
        tokenEntityList?.map(item => ({
          address: item.owner_addr,
          amount: item.amount,
        })) || fromAddress;

      accounts.map(item => {
        const idx = fromAddressList?.findIndex(i =>
          isSameAddress(i.address, item.address),
        );
        if (idx > -1) {
          res.push({
            address: item.address,
            amountStr: formatTokenAmount(fromAddressList[idx].amount),
            amount: fromAddressList[idx].amount,
            aliasName: item.aliasName || ellipsisAddress(item.address),
            type: item.type,
          });
        }
      });

      return res.sort((a, b) =>
        new BigNumber(b.amount).comparedTo(new BigNumber(a.amount)),
      );
    }
  }, [token, accounts, isSingleAddress, finalAccount, tokenEntityList]);

  const unHold = useMemo(
    () => _unHold || tokenFromAddress.length === 0,
    [_unHold, tokenFromAddress],
  );

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={triggerUpdate}
        isMultiAddress={!isSingleAddress}
        refreshTags={refreshTag}
        unHold={unHold}
      />
    );
  }, [token, triggerUpdate, isSingleAddress, refreshTag, unHold]);

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
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle, unHold]);

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
        screen: isSingleAddress ? RootNames.Swap : RootNames.MultiSwap,
        params: {
          chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
          tokenId: token?._tokenId,
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
        screen: isSingleAddress ? RootNames.Bridge : RootNames.MultiBridge,
        params: {
          toChainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
          toTokenId: token?._tokenId,
        },
      });
    },
  );

  const { amountSum, usdValue, percentChange, isLoss, is24hNoChange } =
    useTokenBalance({
      token: tokenWithAmount || token,
      amountList: tokenFromAddress,
      isSingleAddress: !!isSingleAddress,
      relateDefiList,
      currentAddress: finalAccount?.address,
    });

  const { t } = useTranslation();

  const handleOpenTokenDetail = useCallback(() => {
    navigate(RootNames.TokenDetail, {
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

  const [loading, setLoading] = useState(true);
  const handleRefresh = useCallback(() => {
    refreshTokenEntity();
    refreshAsync();
    tokenPriceChartRef.current?.refreshChart();
  }, [refreshAsync, refreshTokenEntity]);

  if (isSingleAddress && !finalAccount) {
    return null;
  }

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
        headerContainerStyle={styles.tabBarWrap}>
        <Tabs.Tab label={renderMarketDataLabel} name="marketData">
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} />
            }
            style={styles.innerContainer}>
            {!!amountSum && (
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
              {loading && (
                <Skeleton
                  width={screenWidth - 32}
                  height={300}
                  LinearGradientComponent={LoadingLinear}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 16,
                    right: 16,
                    bottom: 0,
                    zIndex: 100,
                  }}
                />
              )}
              <TradingViewCandleChart
                ref={chartWebViewRef}
                height={300}
                onChartReady={() => {
                  setTimeout(() => {
                    setLoading(false);
                    chartWebViewRef.current?.setData(invalidCandleData);
                  }, 0);
                }}
              />
              <TokenPriceChart
                ref={tokenPriceChartRef}
                token={tokenWithAmount || token}
                amountList={[]}
                relateDefiList={[]}
              />
            </View>
            <TokenChainAndContract token={token} tokenEntity={tokenEntity} />
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
            <IssuerAndListSite
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
  };
});
