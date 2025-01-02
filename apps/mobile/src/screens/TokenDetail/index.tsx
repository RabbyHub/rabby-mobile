/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
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
import {
  TxDisplayItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';
import { useRoute } from '@react-navigation/native';
import { useInfiniteScroll, useMemoizedFn, useRequest } from 'ahooks';
import { chain, last } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { HistoryDisplayItem } from '../Transaction/MultiAddressHistory';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { HistoryList } from './components/HistoryList';
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
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { RcIconRightCC } from '@/assets/icons/common';
import {
  CombineDefiItem,
  CombineTokensItem,
  useAssetsMap,
} from '../Home/hooks/store';
import { useQueryProjects } from '../Search/useAssets';
import { DisplayedProject, DisplayedPortfolio } from '../Home/utils/project';
import { RelatedDeFi } from './components/RelatedDeFi';
import { navigate } from '@/utils/navigation';
import { formatTokenAmount } from '@/utils/number';

const PAGE_COUNT = 10;
const isAndroid = Platform.OS === 'android';

type RelatedDeFi = DisplayedProject & { amount: string };

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
export const RightMore: React.FC<{
  token: AbstractPortfolioToken;
  address: string;
  triggerUpdate: () => void;
}> = ({ token, address, triggerUpdate }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { refreshTags } = useRefreshTags(address);
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
            preferenceService.manualUnFoldToken(address, {
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldToken(address, {
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
        title: token._isPined
          ? t('page.tokenDetail.action.unpin')
          : t('page.tokenDetail.action.pin'),
        icon: token._isPined
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
        androidIconName: token._isPined
          ? 'ic_rabby_menu_un_pin'
          : 'ic_rabby_menu_pin',
        key: 'pin',
        action() {
          if (token._isPined) {
            preferenceService.removePinedToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unpin_success'));
          } else {
            preferenceService.pinToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.pin_success'));
          }
          token._isPined = !token._isPined;
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
            preferenceService.includeBalanceToken(address, {
              id: token._tokenId,
              chainid: token.chain,
              type: 'token',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.includeBalance_success'),
            );
          } else {
            preferenceService.excludeBalance(address, {
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
  }, [token, t, isDarkTheme, refreshTags, address, triggerUpdate]);
  const onPress = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  return (
    <>
      <HeaderRightHistory isInTokenDetail={true} isMultiAddress={false} />
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
  const { token, account } = (route.params || {}) as {
    token: CombineTokensItem;
    account: KeyringAccountWithAlias;
  };

  console.log('tokenDetail token:', token.fromAddress);
  // const { token, account } = useNavigationState(
  //   s => s.routes.find(r => r.name === RootNames.TokenDetail)?.params,
  // ) as {
  //   token: AbstractPortfolioToken;
  //   account: KeyringAccountWithAlias;
  // };

  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  // const { tokens, portfolios, nftList } = useQueryProjects();
  const [asssest] = useAssetsMap();

  // console.log('tokenDetail portfolios:', portfolios);

  const { safeOffBottom } = useSafeSizes();

  const relateDefiList = useMemo(() => {
    const resList = [] as RelatedDeFi[];

    Object.values(asssest).map(({ portfolios }) => {
      portfolios?.map(portfolio => {
        if (portfolio.chain !== token.chain) {
          return;
        }

        let amount = 0;
        const { _portfolios } = portfolio;
        _portfolios?.map(portfolioItem => {
          const { _tokenList } = portfolioItem;
          console.log('_tokenList:', _tokenList);

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
            amount: formatTokenAmount(Math.abs(amount)),
          });
      });
    });
    console.log('relateDefiList length:', resList.length);
    return resList;
  }, [token, asssest]);

  // const relateDefiList = useMemo(() => {
  //   const resList = [] as CombineDefiItem[];

  //   portfolios.map(portfolio => {
  //     if (portfolio.chain !== token.chain) {
  //       return;
  //     }

  //     let amount = 0;
  //     const { _portfolios } = portfolio;
  //     _portfolios?.map(portfolioItem => {
  //       const { _tokenList } = portfolioItem;
  //       console.log('_tokenList:', _tokenList);

  //       const sameItem = _tokenList.find(
  //         item => item._tokenId === token._tokenId,
  //       );
  //       if (sameItem) {
  //         amount += sameItem.amount;
  //       }
  //     });

  //     amount &&
  //       resList.push({
  //         ...portfolio,
  //         amount: formatTokenAmount(Math.abs(amount)),
  //       });
  //   });

  //   console.log('relateDefiList length:', resList.length);

  //   return resList;
  // }, [portfolios, token]);

  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      navigate(RootNames.DeFiDetail, {
        data,
        portfolioList: itemList,
        cache: true,
        symbol: token.symbol,
      });
    },
    [token],
  );

  const isTestnet = false;
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { currentAccount } = useCurrentAccount();
  const finalAccount = account || currentAccount;

  const { data: tokenWithAmount } = useRequest(
    async () => {
      // if (!finalAccount || !token || token.amount) {
      //   return token;
      // }

      const res = await openapi.getToken(
        finalAccount.address,
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
        address={finalAccount.address}
        triggerUpdate={triggerUpdate}
      />
    );
  }, [finalAccount.address, token, triggerUpdate]);

  const getHeaderTitle = useCallback(() => {
    return (
      <TokenDetailHeaderArea key={currentAccount?.address} token={token} />
    );
  }, [currentAccount?.address, token]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
      headerTitleAlign: 'left',
    });
  }, [setNavigationOptions, getHeaderRight, getHeaderTitle]);

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleSend = useMemoizedFn(async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Send,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?._tokenId,
      },
    });
  });

  const handleSwap = useMemoizedFn(
    async (type: 'Buy' | 'Sell', address?: string) => {
      const chain = findChain({
        serverId: token.chain,
      });
      await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.Swap,
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

  const tokenSupportSwap = useMemo(() => {
    const tokenChain = findChain({ serverId: token?.chain })?.enum;

    return !!tokenChain && SWAP_SUPPORT_CHAINS.includes(tokenChain);
  }, [token]);

  if (!finalAccount) {
    return null;
  }

  return (
    <NormalScreenContainer2024 type="bg1" style={styles.root}>
      <View>
        <Text style={styles.currentText}>Current price</Text>
        <TokenPriceChart token={tokenWithAmount || token} />
        <View style={styles.divider} />
        <TokenArea
          handleSwap={handleSwap}
          amountList={
            !account
              ? token.fromAddress
              : [
                  {
                    ...token,
                    amount: token._amountStr!,
                    address: finalAccount.address,
                  },
                ]
          }
          token={tokenWithAmount || token}
        />
      </View>
      {relateDefiList.length > 0 && (
        <RelatedDeFi
          deFiList={relateDefiList}
          symbol={token.symbol}
          handleGoDeFi={handleOpenDefiDetail}
        />
      )}
      <View style={{ height: isAndroid ? 40 + safeOffBottom : 76 }} />
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 40 + safeOffBottom },
        ]}>
        <Button
          title={t('page.tokenDetail.action.send')}
          containerStyle={styles.btnContainer}
          type="ghost"
          onPress={handleSend}
        />
        <View style={styles.btnGap} />
        <Button
          title={t('page.tokenDetail.action.Buy')}
          containerStyle={StyleSheet.flatten([styles.btnContainer])}
          buttonStyle={styles.buyBtnContainer}
          titleStyle={styles.buyBtnTitle}
          // type={'ghost'}
          onPress={() => handleSwap('Buy')}
          disabled={!tokenSupportSwap}
        />
        <View style={styles.btnGap} />
        <Button
          title={t('page.tokenDetail.action.Sell')}
          containerStyle={styles.btnContainer}
          onPress={() => handleSwap('Sell')}
          disabled={!tokenSupportSwap}
        />
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
      paddingBottom: 76,
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
