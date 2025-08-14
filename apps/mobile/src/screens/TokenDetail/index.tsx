/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken, AbstractProject } from '@/screens/Home/types';
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
import { useSetAtom } from 'jotai';
import { isFromBackAtom } from '../Swap/hooks/atom';
import BalanceOverview from './components/BalanceOverview';
import { useTokenBalance } from './hook';
import TokenActions from './components/TokenActions';
import BottomFloatGuide from './components/BottomFloatGuide';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { RightMore } from './components/RightMore';

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
    rawPortfolios, // only isSingleAddress === true can use
  } = route.params || {};

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

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

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { data: tokenWithAmount } = useRequest(
    async () => {
      const res = await openapi.getToken(
        finalAccount!.address,
        token.chain,
        token._tokenId,
      );
      return ensureAbstractPortfolioToken({
        ...abstractTokenToTokenItem(token),
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
        titleStyle={{ fontSize: 20, lineHeight: 24 }}
      />
    );
  }, [finalAccount?.address, token]);

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

  const handleOpenTokenMarketInfo = useCallback(() => {
    navigate(RootNames.TokenMarketInfo, {
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
      token: tokenWithAmount || token,
      amountList: tokenFromAddress,
      isSingleAddress: !!isSingleAddress,
      relateDefiList,
      currentAddress: finalAccount?.address,
    });

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
      <ScrollView>
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
            <Text style={styles.floatPrice}>{formatPrice(price)}</Text>
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
