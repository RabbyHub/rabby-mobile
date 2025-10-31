/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { createGetStyles2024 } from '@/utils/styles';
import { abstractTokenToTokenItem } from '@/utils/token';
import { preferenceService } from '@/core/services';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { TokenArea } from './components/TokenArea';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { CombineTokensItem } from '../Home/hooks/store';
import { formatPrice, formatTokenAmount } from '@/utils/number';
import { useAssets } from '../Search/useAssets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { ellipsisAddress } from '@/utils/address';
import BigNumber from 'bignumber.js';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { HistoryList } from './components/HistoryList';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useAtomValue, useSetAtom } from 'jotai';
import { isFromBackAtom } from '../Swap/hooks/atom';
import BalanceOverview from './components/BalanceOverview';
import { useRealTimeTokenInfo, useTokenBalance } from './hook';
import TokenActions from './components/TokenActions';
import BottomFloatGuide from './components/BottomFloatGuide';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated, naviPush } from '@/utils/navigation';
import { RightMore } from './components/RightMore';
import { currentPortfolioAtom } from '../Home/hooks/usePortfolio';
import { RelatedDeFi } from './components/RelatedDeFi';

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

export const TokenDetailScreen = () => {
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
  } = route.params || {};

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  const singleAddressPortfolios = useAtomValue(currentPortfolioAtom);
  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { safeOffHeader } = useSafeSizes();
  const {
    assetsMap,
    getCacheTop10Assets,
    getTokenCombined,
    loadSpecificDefi,
    updateTokensAmount,
  } = useAssets({
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
  const { top10Addresses, list: accounts, rawAllAccounts } = useAccountInfo();

  const finalAccount = useMemo(() => {
    return account || accounts[0] || preferenceService.getFallbackAccount();
  }, [account, accounts]);

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
    if (
      isSingleAddress &&
      isSameAddress(singleAddressPortfolios.address, finalAccount.address) &&
      singleAddressPortfolios.data &&
      singleAddressPortfolios.data.length
    ) {
      singleAddressPortfolios.data?.forEach(portfolio => {
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
            address: singleAddressPortfolios.address,
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
    isSingleAddress,
    singleAddressPortfolios.data,
    singleAddressPortfolios.address,
    assetsMap,
    token.chain,
    token._tokenId,
    finalAccount,
    accounts,
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

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { data: baseTokenInfo, refreshAsync: refreshBaseTokenInfo } =
    useRequest(
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
        key={finalAccount?.address}
        token={token}
        tokenSize={20}
        chainSize={10}
        borderChain
        style={{ justifyContent: 'center' }}
        titleStyle={{ fontSize: 20 }}
      />
    );
  }, [finalAccount?.address, token]);

  const { tokens: realTimeTokens, refreshAsync } = useRealTimeTokenInfo({
    chain: token.chain,
    tokenId: token._tokenId,
  });

  const tokenFromAddress = useMemo(() => {
    const res = [] as TokenFromAddressItem[];
    if (isSingleAddress && token.amount) {
      const realTimeToken = realTimeTokens.find(
        item =>
          isSameAddress(item.address, finalAccount.address) &&
          item.token.id === token._tokenId &&
          item.token.chain === token.chain,
      )?.token;
      const targetToken =
        realTimeToken ||
        tokenEntityList?.find(item =>
          isSameAddress(item.owner_addr, finalAccount!.address),
        );
      const amount = targetToken?.amount || token.amount;
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
        tokenEntityList?.map(item => {
          const realTimeAmount = realTimeTokens.find(
            rItem =>
              isSameAddress(rItem.address, item.owner_addr) &&
              rItem.token.id === token._tokenId &&
              rItem.token.chain === token.chain,
          )?.token.amount;
          return {
            address: item.owner_addr,
            amount: realTimeAmount || item.amount,
          };
        }) || fromAddress;

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
  }, [
    isSingleAddress,
    token,
    realTimeTokens,
    tokenEntityList,
    finalAccount,
    accounts,
  ]);

  const unHold = useMemo(
    () => _unHold || tokenFromAddress.length === 0,
    [_unHold, tokenFromAddress],
  );

  const handleOpenTokenMarketInfo = useCallback(() => {
    navigateDeprecated(RootNames.TokenMarketInfo, {
      ...route.params,
    });
  }, [route.params]);

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

  const { amountSum, usdValue, percentChange, isLoss, is24hNoChange, price } =
    useTokenBalance({
      token: baseTokenInfo || token,
      amountList: tokenFromAddress,
      isSingleAddress: !!isSingleAddress,
      relateDefiList,
      currentAddress: finalAccount?.address,
    });

  const onRefresh = useCallback(async () => {
    refreshBaseTokenInfo();
    Promise.all(
      relateDefiList.map(item => {
        if (item.address && item.id && item.chain) {
          return loadSpecificDefi(item.address, item.id, item.chain);
        }
        return Promise.resolve();
      }),
    );
    refreshAsync(tokenFromAddress.map(item => item.address)).then(res => {
      updateTokensAmount(res);
    });
    refreshTag();
  }, [
    refreshBaseTokenInfo,
    relateDefiList,
    refreshAsync,
    tokenFromAddress,
    refreshTag,
    loadSpecificDefi,
    updateTokensAmount,
  ]);

  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      naviPush(RootNames.DeFiDetail, {
        data,
        portfolioList: itemList,
        isSingleAddress,
        account: finalAccount,
        cache: true,
        relateTokenId: token._tokenId,
      });
    },
    [token, isSingleAddress, finalAccount],
  );

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
            ? isLight
              ? require('@/assets2024/singleHome/home-profit-bg-1.png')
              : require('@/assets2024/singleHome/home-profit-dark-bg-1.png')
            : isLight
            ? require('@/assets2024/singleHome/home-loss-bg-1.png')
            : require('@/assets2024/singleHome/home-loss-dark-bg-1.png')
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
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} />
        }>
        <ImageBackground
          source={
            !isLoss
              ? isLight
                ? require('@/assets2024/singleHome/home-profit-bg-2.png')
                : require('@/assets2024/singleHome/home-profit-dark-bg-2.png')
              : isLight
              ? require('@/assets2024/singleHome/home-loss-bg-2.png')
              : require('@/assets2024/singleHome/home-loss-dark-bg-2.png')
          }
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 150,
          }}
        />
        <View style={styles.balanceOverviewContainer}>
          <BalanceOverview
            percentChange={percentChange}
            isLoss={isLoss}
            usdValue={usdValue}
            amount={amountSum}
            is24hNoChange={is24hNoChange}
          />
          <TokenActions
            token={token}
            isSingleAddress={!!isSingleAddress}
            finalAccount={finalAccount}
            tokenSelectType={tokenSelectType}
          />
        </View>
        <TokenArea
          amountList={tokenFromAddress}
          token={token}
          rawAllAccounts={rawAllAccounts}
        />
        {relateDefiList.length > 0 && (
          <RelatedDeFi
            deFiList={relateDefiList}
            symbol={token.symbol}
            handleGoDeFi={handleOpenDefiDetail}
          />
        )}
        <HistoryList
          top10Addresses={top10Addresses}
          finalAccount={finalAccount}
          isForMultipleAddress={!isSingleAddress}
          token={token}
        />
        <View style={{ height: isAndroid ? 120 + safeOffBottom : 156 }} />
      </ScrollView>
      <BottomFloatGuide onPress={handleOpenTokenMarketInfo}>
        <View style={styles.floatingBarContent}>
          <Text style={styles.floatBalanceTitle}>
            {t('page.tokenDetail.guideToMarketData')}
          </Text>
          <View style={styles.floatBalanceContainer}>
            <Text style={styles.floatPrice}>${formatPrice(price)}</Text>
            <Text
              style={[
                styles.floatPriceChange,
                {
                  color: is24hNoChange
                    ? colors2024['neutral-secondary']
                    : isLoss
                    ? colors2024['red-default']
                    : colors2024['green-default'],
                },
              ]}>
              {' '}
              ({is24hNoChange ? '0.0%' : isLoss ? '-' : '+'}
              {percentChange})
            </Text>
          </View>
        </View>
      </BottomFloatGuide>
    </NormalScreenContainer2024>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    rootScreenContainer: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingBottom: 20,
    },
    balanceOverviewContainer: {
      paddingHorizontal: 23,
      marginBottom: 28,
      gap: 24,
    },
    floatingBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    floatBalanceTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    floatBalanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    floatPrice: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    floatPriceChange: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
