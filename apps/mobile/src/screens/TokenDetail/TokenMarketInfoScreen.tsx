/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { Tip } from '@/components/Tip';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken, AbstractProject } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { findChain, getChain } from '@/utils/chain';
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
} from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { TokenPriceChart } from './components/TokenPriceChart';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { toast } from '@/components2024/Toast';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { CombineTokensItem } from '../Home/hooks/store';
import { formatPrice, formatTokenAmount } from '@/utils/number';
import { useAssets } from '../Search/useAssets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { ellipsisAddress } from '@/utils/address';
import BigNumber from 'bignumber.js';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenChainAndContract } from './components/TokenChainAndContract';
import { IssuerAndListSite } from './components/IssuerAndListSite';
import RcIconDanger from '@/assets2024/icons/search/RcIconDanger.svg';
import RcIconWarning from '@/assets2024/icons/search/RcIconWarning.svg';
import { useExternalSwapBridgeDapps } from '@/components/ExternalSwapBridgeDappPopup/hook';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useAtom, useSetAtom } from 'jotai';
import {
  isFromBackAtom,
  shouldHideSelectorPopupAtom,
} from '../Swap/hooks/atom';
import { useTokenBalance } from './hook';
import { RightMore } from './components/RightMore';
import HeaderBalanceCard from './components/HeaderBalanceCard';
import { navigate } from '@/utils/navigation';
import { Tabs } from 'react-native-collapsible-tab-view';
import { DynamicCustomMaterialTabBar } from './components/CustomTabBar';

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

const { width: screenWidth } = Dimensions.get('window');

export const RiskTokenTips = ({ isDanger }: { isDanger?: boolean }) => {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  return isDanger ? (
    <View style={styles.searchTokenDanger}>
      <View style={styles.tokenRowContent}>
        <RcIconDanger />
        <Text style={styles.searchTokenDangerText}>
          {t('page.search.tokenItem.verifyDangerTips')}
        </Text>
      </View>
    </View>
  ) : (
    <View style={styles.searchTokenWarning}>
      <View style={styles.tokenRowContent}>
        <RcIconWarning />
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

  const [, setShouldHideSelectorPopup] = useAtom(shouldHideSelectorPopupAtom);
  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { safeOffHeader } = useSafeSizes();
  const [isUp, setIsUp] = useState(true);
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

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();

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

  const { data: tokenEntity, loading: entityLoading } = useRequest(
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
    return <TokenDetailHeaderArea key={finalAccount?.address} token={token} />;
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

  const tokenChain = useMemo(() => {
    return getChain(token?.chain);
  }, [token?.chain]);

  const { isSupportedChain, data: externalSwapDapps } =
    useExternalSwapBridgeDapps(tokenChain!.enum, 'swap');

  const tokenSupportSwap = useMemo(
    () => isSupportedChain || externalSwapDapps.length > 0,
    [isSupportedChain, externalSwapDapps],
  );

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
        setShouldHideSelectorPopup(false);
        setIsFromBack(true);
      };
    }, [setShouldHideSelectorPopup, setIsFromBack]),
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

  const handleSwap = useMemoizedFn(
    async (
      type: 'Buy' | 'Sell',
      address?: string,
      accountType?: KEYRING_TYPE,
    ) => {
      if (!tokenSupportSwap) {
        toast.error('Token not support');
        return;
      }

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
      setShouldHideSelectorPopup(false);
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
          isUp
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
          width: screenWidth,
          height: 150,
          zIndex: -100,
        }}
      />
    );
  }, [isLight, isUp]);

  const renderTabBar = React.useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          tabStyle: styles.tabBar,
          activeColor: colors2024['neutral-body'],
          inactiveColor: colors2024['neutral-secondary'],
          labelStyle: styles.label,
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
    [
      colors2024,
      externalContent,
      styles.indicator,
      styles.label,
      styles.tabBar,
      styles.tabsBarContainer,
    ],
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
    };
  }, [styles.riskContainer, token.is_suspicious, token.is_verified]);

  if (isSingleAddress && !finalAccount) {
    return null;
  }

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <ImageBackground
        source={
          isUp
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

      <Tabs.Container
        renderTabBar={renderTabBar}
        tabBarHeight={30}
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}>
        <Tabs.Tab
          label={t('page.tokenDetail.tabs.marketData')}
          name="marketData">
          <ScrollView style={styles.innerContainer}>
            <HeaderBalanceCard
              amount={formatTokenAmount(amountSum)}
              usdValue={formatPrice(usdValue)}
              percentChange={percentChange}
              isLoss={isLoss}
              is24hNoChange={is24hNoChange}
              style={styles.headerBalanceCard}
              onPress={handleOpenTokenDetail}
            />
            <View style={{ position: 'relative' }}>
              <TokenPriceChart
                token={tokenWithAmount || token}
                onUpChange={b => setIsUp(b)}
                amountList={[]}
                relateDefiList={[]}
              />
            </View>
            <TokenChainAndContract token={token} tokenEntity={tokenEntity} />
            <View style={{ height: isAndroid ? 120 + safeOffBottom : 156 }} />
          </ScrollView>
        </Tabs.Tab>
        <Tabs.Tab
          label={t('page.tokenDetail.tabs.tokenSecurity')}
          name="tokenSecurity">
          <ScrollView style={styles.innerContainer}>
            {riskInfo.content}
            <IssuerAndListSite
              tokenEntity={tokenEntity}
              entityLoading={entityLoading}
            />
            <View style={{ height: isAndroid ? 120 + safeOffBottom : 156 }} />
          </ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 50 + safeOffBottom },
        ]}>
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
          <Tip
            placement="top"
            content={
              !tokenSupportSwap
                ? t('page.tokenDetail.notSupportedOnChain')
                : undefined
            }>
            <Button
              title={
                isFromSwap
                  ? t('global.Confirm')
                  : t('page.tokenDetail.action.Sell')
              }
              containerStyle={StyleSheet.flatten([styles.btnContainer])}
              onPress={() =>
                handleSwap('Sell', finalAccount?.address, finalAccount?.type)
              }
              buttonStyle={styles.btnInnerContainer}
              disabled={!tokenSupportSwap}
            />
          </Tip>
        </View>
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
      marginBottom: 12,
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
      borderRadius: 16,
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
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
    },
    searchTokenDangerText: {
      color: colors2024['red-default'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
    },
    headerBalanceCard: {
      marginTop: 12,
      marginHorizontal: 18,
      marginBottom: 12,
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
    label: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
      textTransform: 'none',
      textAlign: 'center',
      color: colors2024['neutral-body'],
    },
    indicator: {
      backgroundColor: colors2024['neutral-body'],
      height: 4,
      borderRadius: 100,
    },
  };
});
