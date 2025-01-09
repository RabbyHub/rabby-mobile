/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { Tip } from '@/components/Tip';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
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
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { TokenArea } from './components/TokenArea';
import { TokenPriceChart } from './components/TokenPriceChart';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcIconMore } from '@/assets/icons/home';
import { trigger } from 'react-native-haptic-feedback';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { useRefreshTags } from '../Home/hooks/token';
import { toast } from '@/components2024/Toast';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { HeaderRightHistory } from '../Home/SingleHomeRightArea';
import { CombineTokensItem, useAssetsMap } from '../Home/hooks/store';
import { DisplayedProject } from '../Home/utils/project';
import { RelatedDeFi } from './components/RelatedDeFi';
import { navigate, naviPush } from '@/utils/navigation';
import { formatTokenAmount } from '@/utils/number';
import { useAssets } from '../Search/useAssets';
import { HomePinBadge } from './components/PinBadge';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { ellipsisAddress } from '@/utils/address';
import { useSortAddressList } from '../Address/useSortAddressList';
import BigNumber from 'bignumber.js';
import { RootStackParamsList } from '@/navigation-type';

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
}> = ({ token, triggerUpdate, isMultiAddress }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { refreshTagToken } = useRefreshTags();
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
          refreshTagToken();
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
          refreshTagToken();
          triggerUpdate();
        },
      },
    ] as MenuAction[];
  }, [token, t, isDarkTheme, refreshTagToken, triggerUpdate]);
  const onPress = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  return (
    <>
      <HeaderRightHistory
        isInTokenDetail={true}
        tokenItem={token}
        isMultiAddress={isMultiAddress}
      />
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

export const TokenDetailScreen = () => {
  const route = useRoute();
  const {
    fromPortfolio,
    token: _token,
    account,
    needUseCacheToken,
    unHold: _unHold,
    isSingleAddress,
  } = (route.params || {}) as RootStackParamsList[typeof RootNames.TokenDetail];

  const { styles } = useTheme2024({
    getStyle,
  });

  const [asssest] = useAssetsMap();
  const { tokens: cacheAssets } = useAssets();
  const token: AbstractPortfolioToken | CombineTokensItem = useMemo(() => {
    if (fromPortfolio) {
      const iToken = cacheAssets.find(
        item => item._tokenId === _token.id && item.chain === _token.chain,
      );
      return iToken || _token;
    }
    if (needUseCacheToken) {
      const iToken = cacheAssets.find(item => item.id === _token.id);
      return iToken || _token;
    }
    return _token;
  }, [cacheAssets, _token, needUseCacheToken, fromPortfolio]);
  const { safeOffBottom } = useSafeSizes();
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const relateDefiList = useMemo(() => {
    const resList = [] as RelatedDeFiType[];

    Object.keys(asssest).map((address, index) => {
      if (isSingleAddress && !isSameAddress(address, account!.address)) {
        return;
      }

      if (
        !isSingleAddress &&
        accounts.findIndex(item => isSameAddress(item.address, address)) < 0
      ) {
        // filter watch address not in myaccounts
        return;
      }

      const { portfolios } = asssest[address];
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
    console.debug('relateDefiList length:', resList.length);
    return resList;
  }, [token, asssest, isSingleAddress, account, accounts]);
  const { currentAccount } = useCurrentAccount();
  const finalAccount = account || currentAccount;

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
      refreshDeps: [token, finalAccount],
    },
  );

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();

  const getHeaderRight = useCallback(() => {
    return (
      <RightMore
        token={token}
        triggerUpdate={triggerUpdate}
        isMultiAddress={!isSingleAddress}
      />
    );
  }, [token, triggerUpdate, isSingleAddress]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea key={currentAccount?.address} token={token} />
    );
  }, [currentAccount?.address, token]);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleSend = useMemoizedFn(async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    if (isSingleAddress) {
      await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    }
    navigation.push(RootNames.StackTransaction, {
      screen: isSingleAddress ? RootNames.Send : RootNames.MultiSend,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?._tokenId,
      },
    });
  });
  const tokenFromAddress = useMemo(() => {
    const res = [] as TokenFromAddressItem[];
    if (isSingleAddress) {
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
    <NormalScreenContainer2024 type="bg1" style={styles.root}>
      <ScrollView>
        <View style={{ position: 'relative' }}>
          <HomePinBadge token={token} />
          <Text style={styles.currentText}>Current price</Text>
          <TokenPriceChart
            token={tokenWithAmount || token}
            isPin={token._isPined}
          />
          <View style={styles.divider} />
          <TokenArea
            tokenSupportSwap={tokenSupportSwap}
            handleSwap={handleSwap}
            amountList={tokenFromAddress}
            token={tokenWithAmount || token}
          />
        </View>
        {relateDefiList.length > 0 && !unHold && (
          <RelatedDeFi
            deFiList={relateDefiList}
            symbol={token.symbol}
            handleGoDeFi={handleOpenDefiDetail}
          />
        )}
        <View style={{ height: isAndroid ? 90 + safeOffBottom : 126 }} />
      </ScrollView>
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 40 + safeOffBottom },
        ]}>
        <Button
          title={t('page.tokenDetail.action.send')}
          containerStyle={styles.btnContainer}
          type="ghost"
          disabled={unHold}
          onPress={handleSend}
        />
        <View style={styles.btnGap} />
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
                unHold
                  ? t('page.tokenDetail.action.Sell')
                  : t('page.tokenDetail.action.Buy')
              }
              containerStyle={StyleSheet.flatten([styles.btnContainer])}
              onPress={() => handleSwap('Buy')}
              disabled={!tokenSupportSwap || unHold}
            />
          </Tip>
        </View>
        <View style={styles.btnGap} />
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
                unHold
                  ? t('page.tokenDetail.action.Buy')
                  : t('page.tokenDetail.action.Sell')
              }
              containerStyle={styles.btnContainer}
              onPress={() => handleSwap(unHold ? 'Buy' : 'Sell')}
              disabled={!tokenSupportSwap}
            />
          </Tip>
        </View>
      </View>
    </NormalScreenContainer2024>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    root: {},

    currentText: {
      marginLeft: 26,
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },
    divider: {
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
      paddingBottom: 56,
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
  };
});
