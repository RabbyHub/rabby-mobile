import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/home/types';
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
import { last } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { HistoryDisplayItem } from '../Transaction/MultiAddressHistory';
import { TokenDetailHeaderArea } from './components/HeaderArea';
import { HistoryList } from './components/HistoryList';
import { TokenBalanceArea } from './components/TokenBalanceArea';
import { TokenPriceChart } from './components/TokenPriceChart';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcIconMore } from '@/assets/icons/home';
import { trigger } from 'react-native-haptic-feedback';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { useRefreshTags } from '../Home/hooks/token';
import { toast } from '@/components2024/Toast';

const PAGE_COUNT = 10;
const isAndroid = Platform.OS === 'android';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
export const RightMore: React.FC<{
  token: AbstractPortfolioToken;
  address: string;
}> = ({ token, address }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { refreshTags } = useRefreshTags();
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
        androidIconName: 'ic_rabby_menu_edit',
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
          refreshTags(address);
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
            preferenceService.removePinedToken(address, {
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unpin_success'));
          } else {
            preferenceService.pinToken(address, {
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.pin_success'));
          }
          token._isPined = !token._isPined;
          refreshTags(address);
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
        androidIconName: 'ic_rabby_menu_more',
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
          refreshTags(address);
        },
      },
    ] as MenuAction[];
  }, [token, t, isDarkTheme, refreshTags, address]);
  const onPress = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  return (
    <DropDownMenuView
      menuConfig={{
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'press' }}>
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </DropDownMenuView>
  );
};
export const TokenDetailScreen = () => {
  const route = useRoute();
  const { token, account } = (route.params || {}) as {
    token: AbstractPortfolioToken;
    account: KeyringAccountWithAlias;
  };
  // const { token, account } = useNavigationState(
  //   s => s.routes.find(r => r.name === RootNames.TokenDetail)?.params,
  // ) as {
  //   token: AbstractPortfolioToken;
  //   account: KeyringAccountWithAlias;
  // };

  const { styles } = useTheme2024({
    getStyle,
  });

  const { safeOffBottom } = useSafeSizes();

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

  type LoadData = {
    earliest?: TxDisplayItem['time_at'] | undefined;
    tokenId?: AbstractPortfolioToken['_tokenId'] | null;
    list: HistoryDisplayItem[];
  };
  const {
    data: latestData,
    loading,
    loadingMore,
    loadMore,
    reloadAsync,
  } = useInfiniteScroll<LoadData>(
    async currentData => {
      const address = finalAccount?.address;
      const lastEarliestTime =
        currentData?.earliest ?? last(currentData?.list)?.time_at;
      const tickResult: LoadData = {
        earliest: lastEarliestTime ?? undefined,
        tokenId: token?._tokenId,
        list: [],
      };

      if (!token || isTestnet) {
        return tickResult;
      }

      try {
        const res: TxHistoryResult = await openapi.listTxHisotry({
          id: finalAccount?.address,
          chain_id: token?.chain,
          start_time: lastEarliestTime ?? undefined,
          page_count: PAGE_COUNT,
          token_id: token?._tokenId,
        });
        const { project_dict, cate_dict, token_dict, history_list: list } = res;
        const displayList: HistoryDisplayItem[] = list
          .map(item => ({
            ...item,
            projectDict: project_dict,
            cateDict: cate_dict,
            tokenDict: token_dict,
            account: finalAccount,
            address,
            key: `${address}_${item.chain}_${item.id}`,
          }))
          .sort((v1, v2) => v2.time_at - v1.time_at);

        tickResult.earliest = last(displayList)?.time_at;

        tickResult.list = !lastEarliestTime
          ? displayList
          : // find out the items that are earlier than the earliest item in current list
            displayList.filter(
              item => !item.time_at || item.time_at <= lastEarliestTime,
            );

        return tickResult;
      } catch (error) {
        console.error(error);
        return tickResult;
      }
    },
    {
      // manual: true,
      reloadDeps: [token, token?._tokenId, isTestnet],
      isNoMore: d => {
        if (isTestnet) {
          return true;
        }
        return !d?.earliest || (d?.list.length || 0) < PAGE_COUNT;
      },
    },
  );

  const isFirstLoading = loading && !latestData?.list?.length;

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => (
        <TokenDetailHeaderArea key={currentAccount?.address} token={token} />
      ),
      headerRight: () => (
        <RightMore token={token} address={finalAccount.address} />
      ),
      headerTitleAlign: 'left',
    });
  }, [
    currentAccount?.address,
    finalAccount.address,
    setNavigationOptions,
    token,
  ]);

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

  const handleSwap = useMemoizedFn(async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Swap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?._tokenId,
      },
    });
  });

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
      <HistoryList
        ListHeaderComponent={
          <>
            <View>
              <TokenPriceChart token={tokenWithAmount || token} />
              <View style={styles.divider} />
              <TokenBalanceArea
                account={finalAccount}
                token={tokenWithAmount || token}
              />
            </View>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>
                {t('page.tokenDetail.transactions')}
              </Text>
            </View>
          </>
        }
        list={latestData?.list || []}
        loading={isFirstLoading}
        loadingMore={loadingMore}
        refreshLoading={loading}
        loadMore={loadMore}
      />
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 20 + safeOffBottom },
        ]}>
        <Button
          title={t('page.tokenDetail.action.swap')}
          containerStyle={styles.btnContainer}
          onPress={handleSwap}
          disabled={!tokenSupportSwap}
        />
        <View style={styles.btnGap} />

        <Button
          title={t('page.tokenDetail.action.send')}
          containerStyle={styles.btnContainer}
          type="ghost"
          onPress={handleSend}
        />
      </View>
    </NormalScreenContainer2024>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    root: {},

    divider: {
      marginHorizontal: 20,
      backgroundColor: colors2024['neutral-line'],
      height: 1,
    },
    historyTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
    },
    historyHeader: {
      marginBottom: 16,
      paddingHorizontal: 20,
    },
    buttonGroup: {
      width: '100%',
      display: 'flex',
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

    btnGap: {
      width: 10,
    },
  };
});
