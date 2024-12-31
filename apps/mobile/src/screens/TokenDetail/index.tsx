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
import { Platform, StyleSheet, Text, View } from 'react-native';
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
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { HeaderRightHistory } from '../Home/SingleHomeRightArea';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { RcIconRightCC } from '@/assets/icons/common';

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
    token: AbstractPortfolioToken;
    account: KeyringAccountWithAlias;
  };
  // const { token, account } = useNavigationState(
  //   s => s.routes.find(r => r.name === RootNames.TokenDetail)?.params,
  // ) as {
  //   token: AbstractPortfolioToken;
  //   account: KeyringAccountWithAlias;
  // };

  const { styles, colors2024 } = useTheme2024({
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
  const { triggerUpdate } = useTriggerHomeBalanceUpdate();

  const isFirstLoading = loading && !latestData?.list?.length;

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => (
        <TokenDetailHeaderArea key={currentAccount?.address} token={token} />
      ),
      headerRight: () => (
        <RightMore
          token={token}
          address={finalAccount.address}
          triggerUpdate={triggerUpdate}
        />
      ),
      headerTitleAlign: 'left',
    });
  }, [
    currentAccount?.address,
    finalAccount.address,
    setNavigationOptions,
    token,
    triggerUpdate,
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

  const handleSwap = useMemoizedFn(async (type: 'Buy' | 'Sell') => {
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
      <View>
        <Text style={styles.currentText}>Current price</Text>
        <TokenPriceChart token={tokenWithAmount || token} />
        <View style={styles.divider} />
        <TokenBalanceArea
          account={finalAccount}
          token={tokenWithAmount || token}
        />
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.relateTitle}>
          {t('page.tokenDetail.relateDefi')}
        </Text>
      </View>
      {/* flatlist */}
      <View style={styles.defiItem}>
        <View style={styles.defiItemContent}>
          <AssetAvatar
            logo={token?.logo_url}
            size={26}
            chain={token?.chain}
            chainSize={12}
          />
          <Text
            style={styles.defiItemText}
            numberOfLines={1}
            ellipsizeMode="tail">
            {/* {token?.name} */}
            {ellipsisOverflowedText(token?.name, 20)}
          </Text>
        </View>
        <View style={styles.defiItemContent}>
          <Text style={styles.defiItemText}>{`5 ${token.name}`}</Text>
          <RcIconRightCC
            style={styles.arrowStyle}
            width={13}
            height={13}
            color={colors2024['neutral-secondary']}
          />
        </View>
      </View>
      <View
        style={[
          styles.buttonGroup,
          isAndroid && { paddingBottom: 20 + safeOffBottom },
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
      marginTop: 2,
    },
    defiItemText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
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
