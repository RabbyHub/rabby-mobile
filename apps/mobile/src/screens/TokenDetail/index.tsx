/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { Tip } from '@/components/Tip';
import { useCurrentAccount, useMyAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from '@/screens/home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { abstractTokenToTokenItem } from '@/utils/token';
import { CHAINS_ENUM } from '@debank/common';
import { preferenceService } from '@/core/services';
import { useRoute } from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { TokenArea } from './components/TokenArea';
import { TokenPriceChart } from './components/TokenPriceChart';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcIconMore } from '@/assets/icons/home';
import { trigger } from 'react-native-haptic-feedback';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { toast } from '@/components2024/Toast';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { HeaderRightHistory } from '../Home/SingleHomeRightArea';
import { CombineTokensItem } from '../Home/hooks/store';
import { RelatedDeFi } from './components/RelatedDeFi';
import { navigate, naviPush } from '@/utils/navigation';
import { formatTokenAmount } from '@/utils/number';
import { useAssets } from '../Search/useAssets';
import { HomePinBadge } from './components/PinBadge';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { ellipsisAddress } from '@/utils/address';
import BigNumber from 'bignumber.js';
import { GetRootScreenNavigationProps } from '@/navigation-type';
import { TokenChainAndContract } from './components/TokenChainAndContract';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import LinearGradient from 'react-native-linear-gradient';
import { IssuerAndListSite } from './components/IssuerAndListSite';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { unionBy } from 'lodash';
import { HistoryList } from './components/HistoryList';
import RcIconDanger from '@/assets2024/icons/search/RcIconDanger.svg';
import RcIconWarning from '@/assets2024/icons/search/RcIconWarning.svg';

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

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
export const RightMore: React.FC<{
  token: AbstractPortfolioToken;
  isMultiAddress?: boolean;
  triggerUpdate: () => void;
  refreshTags: () => void;
}> = ({ token, triggerUpdate, isMultiAddress, refreshTags }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();

  const menuActions = React.useMemo(() => {
    return [
      {
        title: token._isFold
          ? t('page.tokenDetail.action.unfold')
          : t('page.tokenDetail.action.fold'),
        icon: token._isFold
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
        androidIconName: token._isFold
          ? 'ic_rabby_menu_unfold'
          : 'ic_rabby_menu_fold',
        key: 'fold',
        action() {
          if (token._isFold) {
            preferenceService.manualUnFoldToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.fold_success'));
          }
          token._isFold = !token._isFold;
          refreshTags();
        },
      },
      {
        title: token._isExcludeBalance
          ? t('page.tokenDetail.action.includeBalance')
          : t('page.tokenDetail.action.excludeBalance'),
        icon: token._isExcludeBalance
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance.png'),
        key: 'balance',
        androidIconName: token._isExcludeBalance
          ? 'ic_rabby_menu_include_balance'
          : 'ic_rabby_menu_exclude_balance',
        action() {
          if (token._isExcludeBalance) {
            preferenceService.includeBalanceToken({
              id: token._tokenId,
              chainid: token.chain,
              type: 'token',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.includeBalance_success'),
            );
          } else {
            preferenceService.excludeBalance({
              id: token._tokenId,
              chainid: token.chain,
              type: 'token',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.excludeBalance_success'),
            );
          }
          token._isExcludeBalance = !token._isExcludeBalance;
          refreshTags();
          triggerUpdate();
        },
      },
    ] as MenuAction[];
  }, [token, t, isDarkTheme, refreshTags, triggerUpdate]);
  const onPress = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  return (
    <>
      <DropDownMenuView
        menuConfig={{
          menuActions: menuActions,
        }}
        triggerProps={{ action: 'press' }}>
        <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
          <RcIconMore width={24} height={24} />
        </CustomTouchableOpacity>
      </DropDownMenuView>
    </>
  );
};

export const RiskTokenTips = ({ isDanger }: { isDanger?: boolean }) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
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
  } = route.params || {};

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  const { safeOffHeader, safeTop } = useSafeSizes();
  const { tokens: cacheAssets, assetsMap, getCacheTop10Assets } = useAssets();

  const token: AbstractPortfolioToken | CombineTokensItem = useMemo(() => {
    if (fromPortfolio || needUseCacheToken) {
      const iToken = cacheAssets.find(
        item =>
          item._tokenId === _token._tokenId && item.chain === _token.chain,
      );
      return iToken || _token;
    }
    return _token;
  }, [cacheAssets, _token, needUseCacheToken, fromPortfolio]);
  const { safeOffBottom } = useSafeSizes();
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });
  const finalAccount = account || currentAccount;

  const relateDefiList = useMemo(() => {
    const resList = [] as RelatedDeFiType[];
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
  }, [token, assetsMap, isSingleAddress, finalAccount, accounts]);

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
  useEffect(() => {
    getCacheTop10Assets({
      disableNFT: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();

  const { data: tokenWithAmount } = useRequest(
    async () => {
      // if (!finalAccount || !token || token.amount) {
      //   return token;
      // }

      const res = await openapi.getToken(
        finalAccount!.address,
        token.chain,
        token._tokenId,
      );
      return ensureAbstractPortfolioToken({
        ...abstractTokenToTokenItem(token),
        usd_value: res?.usd_value,
        price: res?.price,
        amount: res?.amount,
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
      console.log('tokenEntity', res, token._tokenId, token.chain);
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

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={triggerUpdate}
        isMultiAddress={!isSingleAddress}
        refreshTags={refreshTag}
      />
    );
  }, [token, triggerUpdate, isSingleAddress, refreshTag]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea
        key={currentAccount?.address}
        token={token}
        refreshTags={refreshTag}
      />
    );
  }, [currentAccount?.address, token, refreshTag]);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { navigateToSendPolyScreen } = useSendRoutes();

  const handleSend = useMemoizedFn(async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    if (isSingleAddress) {
      await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    }
    navigateToSendPolyScreen(!!isSingleAddress, {
      chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
      tokenId: token?._tokenId,
    });
  });

  const handleBridge = useMemoizedFn(async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    if (isSingleAddress) {
      await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    }
    navigation.push(RootNames.StackTransaction, {
      screen: isSingleAddress ? RootNames.Bridge : RootNames.MultiBridge,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?._tokenId,
      },
    });
  });

  const tokenFromAddress = useMemo(() => {
    const res = [] as TokenFromAddressItem[];
    if (isSingleAddress && token.amount) {
      res.push({
        ...token,
        amountStr: token._amountStr!,
        amount: token.amount,
        address: finalAccount!.address,
        type: finalAccount!.type,
        aliasName:
          finalAccount!.aliasName || ellipsisAddress(finalAccount!.address),
      });
      return res;
    }

    const { fromAddress } = token as CombineTokensItem;
    accounts.map(item => {
      const idx = fromAddress?.findIndex(i =>
        isSameAddress(i.address, item.address),
      );
      if (idx > -1) {
        res.push({
          address: item.address,
          amountStr: formatTokenAmount(fromAddress[idx].amount),
          amount: fromAddress[idx].amount,
          aliasName: item.aliasName || ellipsisAddress(item.address),
          type: item.type,
        });
      }
    });

    return res.sort((a, b) =>
      new BigNumber(b.amount).comparedTo(new BigNumber(a.amount)),
    );
  }, [token, accounts, isSingleAddress, finalAccount]);

  const tokenSupportSwap = useMemo(() => {
    const tokenChain = findChain({ serverId: token?.chain })?.enum;

    return !!tokenChain && SWAP_SUPPORT_CHAINS.includes(tokenChain);
  }, [token]);

  const unHold = useMemo(
    () => _unHold || tokenFromAddress.length === 0,
    [_unHold, tokenFromAddress],
  );

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: unHold ? () => null : getHeaderRight,
      headerTitleAlign: 'left',
    });
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle, unHold]);

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
      navigation.push(RootNames.StackTransaction, {
        screen: isSingleAddress ? RootNames.Swap : RootNames.MultiSwap,
        params: {
          chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
          tokenId: token?._tokenId,
          type,
          address,
        },
      });
    },
  );

  const { t } = useTranslation();

  if (!finalAccount) {
    return null;
  }

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <ImageBackground
        source={
          isLight
            ? require('@/assets2024/icons/home/ImgSingleBgUp.png')
            : require('@/assets2024/icons/home/ImgSingleBgUpDark.png')
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
            isLight
              ? require('@/assets2024/icons/home/ImgSingleBgDown.png')
              : require('@/assets2024/icons/home/ImgSingleBgDownDark.png')
          }
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 250,
          }}
        />
        <View style={styles.riskContainer}>
          {token.is_verified === false && <RiskTokenTips isDanger={true} />}
          {token.is_verified !== false && token.is_scam && (
            <RiskTokenTips isDanger={false} />
          )}
        </View>
        <View style={{ position: 'relative' }}>
          {/* <HomePinBadge token={token} refreshTags={refreshTag} /> */}
          {/* <Text style={styles.currentText}>Current price</Text> */}
          <TokenPriceChart token={tokenWithAmount || token} />
          {/* <View style={styles.divider} /> */}
        </View>
        <TokenArea
          isSingleAddress={isSingleAddress}
          tokenUsdValue={tokenWithAmount?.price}
          finalAccount={finalAccount}
          tokenSupportSwap={tokenSupportSwap}
          handleSwap={handleSwap}
          amountList={tokenFromAddress}
          token={token}
        />
        {relateDefiList.length > 0 && (
          <RelatedDeFi
            deFiList={relateDefiList}
            symbol={token.symbol}
            handleGoDeFi={handleOpenDefiDetail}
          />
        )}
        <IssuerAndListSite
          tokenEntity={tokenEntity}
          entityLoading={entityLoading}
        />
        <TokenChainAndContract token={token} tokenEntity={tokenEntity} />
        <HistoryList
          accounts={accounts}
          finalAccount={finalAccount}
          isForMultipleAdderss={!isSingleAddress}
          token={token}
        />
        <View style={{ height: isAndroid ? 120 + safeOffBottom : 156 }} />
      </ScrollView>
      <LinearGradient
        colors={
          isLight
            ? ['rgba(246, 247, 247, 1)', 'rgba(246, 247, 247, 0.3)']
            : ['rgba(19, 20, 22, 1)', 'rgba(19, 20, 22, 0.3)']
        }
        locations={[0.6393, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={[
          styles.floatBottom,
          isAndroid && { height: 120 + safeOffBottom },
        ]}>
        <View
          style={[
            styles.buttonGroup,
            isAndroid && { paddingBottom: 50 + safeOffBottom },
          ]}>
          <View style={styles.btnContainer}>
            <Tip
              placement="top"
              content={
                !tokenSupportSwap
                  ? t('page.tokenDetail.notSupportedOnChain')
                  : undefined
              }>
              <Button
                title={t('page.swap.title')}
                containerStyle={StyleSheet.flatten([styles.btnContainer])}
                onPress={() => handleSwap('Buy')}
                disabled={!tokenSupportSwap}
              />
            </Tip>
          </View>
        </View>
      </LinearGradient>
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
    currentText: {
      marginLeft: 26,
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },
    floatBottom: {
      width: '100%',
      height: 120,
      paddingTop: 20,
      position: 'absolute',
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      marginTop: 28,
      marginHorizontal: 20,
      backgroundColor: colors2024['neutral-line'],
      height: 1,
    },
    defiItem: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      // paddingHorizontal: 8,
    },
    defiItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 20,
      gap: 6,
    },
    arrowStyle: {
      marginTop: 0,
    },
    defiItemText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      marginLeft: 4,
    },
    relateTitle: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
    },
    historyHeader: {
      marginBottom: 16,
      paddingHorizontal: 20,
    },
    buttonGroup: {
      width: '100%',
      position: 'absolute',
      bottom: 0,
      // display: 'flex',
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

    buyBtnContainer: {
      backgroundColor: colors2024['brand-light-1'],
    },
    buyBtnTitle: {
      color: colors2024['brand-default'],
    },

    btnGap: {
      width: 10,
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
  };
});
