import type { ComponentProps } from 'react';
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from 'react';
import { View, TouchableOpacity } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  DeferredTokenSelectorSheetModal,
  type TokenSelectorSheetModal,
} from '@/components/Token';
import type { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useTokenSelectorModalVisible } from '@/components/Token/TokenSelectorSheetModal';
import {
  getTokenSymbol,
  scamTokenFilter,
  tokenItemToITokenItem,
} from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import type { CHAINS_ENUM } from '@debank/common';
import type { Account } from '@/core/startupServices/preference';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { useScreenSceneAccountContext } from '@/hooks/accountsSwitcher';
import { RootNames } from '@/constant/layout';
import { isWatchOrSafeAccount } from '@/utils/account';
import { useLongPressTokenAtom } from '../hooks';
import { useMemoizedFn, useUnmount } from 'ahooks';
import { useFocusEffect } from '@react-navigation/native';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import type { FavoriteFilterType } from '@/components/Token/FavoriteFilterItem';
import type { ITokenItem } from '@/store/tokens';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useFavoriteTokens } from '@/components/Token/hooks/favorite';
import {
  makeTokenListRequestKey,
  useTokenListAsyncResource,
} from '@/components/Token/hooks/useTokenListAsyncResource';
import { isAddress } from 'viem';
import { Text } from '@/components/Typography';
import { useRegressionScenarioComponentAction } from '@/devtools/regressionScenarios/react';

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  accountInScreen?: Account | null;
  chainId: string;
  excludeTokens?: ITokenItem['id'][];
  type?: ComponentProps<typeof TokenSelectorSheetModal>['type'];
  disableItemCheck?: ITokenCheck;
  placeholder?: string;
  hideChainIcon?: boolean;
  value?: string;
  loading?: boolean;
  tokenRender?:
    | (({
        token,
        openTokenModal,
      }: {
        token?: ITokenItem;
        openTokenModal: () => void;
      }) => React.ReactNode)
    | React.ReactNode;
  supportChains?: CHAINS_ENUM[];
  searchPlaceholder?: string;
}
const defaultExcludeTokens = [];

type QueryConditions = {
  keyword: string;
  account?: Account | null;
  chainServerId: string;
};
export type TokenSelectInst = {
  openTokenModal: (conds?: Partial<QueryConditions>) => void;
};
const SwapToTokenSelect = ({
  token,
  onChange,
  onTokenChange,
  accountInScreen,
  chainId,
  excludeTokens = defaultExcludeTokens,
  type = 'send',
  placeholder,
  supportChains,
  searchPlaceholder,
  disableItemCheck,
  style,
  ref,
}: TokenSelectProps & RNViewProps & { ref?: Ref<TokenSelectInst> }) => {
  const [_queryConds, setQueryConds] = useState<QueryConditions>({
    keyword: '',
    account: accountInScreen,
    chainServerId: chainId,
  });

  const [_favoriteFilterValue, setFavoriteFilterValue] =
    useState<FavoriteFilterType>('all');

  const [_, setLongPressToken] = useLongPressTokenAtom();
  const debouncedKeyword = useDebouncedValue(_queryConds.keyword, 250);
  const queryConds = useMemo(
    () => ({ ..._queryConds, keyword: debouncedKeyword }),
    [_queryConds, debouncedKeyword],
  );
  const currentAccount = queryConds.account;
  const hasSearchKeyword = useMemo(
    () => queryConds.keyword.trim().length > 0,
    [queryConds.keyword],
  );

  const favoriteFilterValue = useMemo(() => {
    if (hasSearchKeyword) {
      return 'all';
    }
    return _favoriteFilterValue;
  }, [_favoriteFilterValue, hasSearchKeyword]);

  const {
    visible: tokenSelectorVisible,
    tokenSelectorModalRef,
    setTokenSelectorVisible,
  } = useTokenSelectorModalVisible();

  useImperativeHandle(ref, () => ({
    openTokenModal: conds => {
      setQueryConds(prev => ({ ...prev, ...conds }));
      setTokenSelectorVisible(true, { noTriggerRerender: false });
    },
  }));

  const currentAddress = currentAccount?.address;
  const tokenListRequestKey = useMemo(
    () =>
      makeTokenListRequestKey([
        currentAddress,
        queryConds.chainServerId,
        queryConds.keyword,
      ]),
    [currentAddress, queryConds.chainServerId, queryConds.keyword],
  );
  const loadSwapTokenList = useCallback(async () => {
    if (!currentAddress) {
      return [];
    }
    if (queryConds.keyword) {
      const _list = await openapi.searchTokensV2({
        q: queryConds.keyword,
        chain_id: queryConds.chainServerId || '',
      });
      const list = isAddress(queryConds.keyword, { strict: false })
        ? _list
        : _list.filter(scamTokenFilter);
      let localAmounts: Array<{
        chain: string;
        tokenId: string;
        amount: number;
      }> = [];
      if (list.length > 0) {
        const tokenList = list.map(t => ({
          chain: t.chain,
          tokenId: t.id,
        }));
        try {
          localAmounts = await TokenItemEntity.getTokenListAmount({
            owner_addr: [currentAddress],
            tokenList,
          });
        } catch (error) {
          console.error('Failed to get local token amounts:', error);
        }
      }

      const amountMap = new Map<string, number>();
      localAmounts.forEach(item => {
        const key = `${item.chain}-${item.tokenId}`;
        amountMap.set(key, item.amount);
      });
      return list.map(item =>
        tokenItemToITokenItem(
          {
            ...item,
            amount: amountMap.get(`${item.chain}-${item.id}`) || 0,
          },
          '',
        ),
      );
    }
    const list = await openapi.getSwapTokenList(
      currentAddress,
      queryConds.chainServerId ? queryConds.chainServerId : undefined,
    );
    return list.map(item => tokenItemToITokenItem(item, ''));
  }, [currentAddress, queryConds.chainServerId, queryConds.keyword]);
  const {
    data: swapTokenList,
    isLoading: swapTokenListLoading,
    isSettled: isSwapTokenListSettled,
  } = useTokenListAsyncResource({
    enabled: Boolean(currentAddress && tokenSelectorVisible),
    requestKey: tokenListRequestKey,
    load: loadSwapTokenList,
  });

  const { userTokenSettings, fetchUserTokenSettings } = useUserTokenSettings();
  const pinedQueue = useMemo(
    () => userTokenSettings.pinedQueue,
    [userTokenSettings.pinedQueue],
  );

  const availableToken = useMemo(() => {
    const _tokens = queryConds.chainServerId
      ? swapTokenList?.filter(t => t.chain === queryConds.chainServerId)
      : swapTokenList;
    return _tokens;
  }, [queryConds.chainServerId, swapTokenList]);

  const { data: favoriteTokens, loading: favoriteTokensLoading } =
    useFavoriteTokens({
      focus: favoriteFilterValue === 'favorite',
      address: currentAddress,
      chainId,
      pinnedTokens: pinedQueue,
    });

  const isListLoading = useMemo(() => {
    return favoriteFilterValue === 'favorite'
      ? favoriteTokensLoading
      : Boolean(currentAddress) &&
          (swapTokenListLoading || !isSwapTokenListSettled);
  }, [
    currentAddress,
    favoriteFilterValue,
    favoriteTokensLoading,
    isSwapTokenListSettled,
    swapTokenListLoading,
  ]);

  const handleSearchTokens = useCallback<
    React.ComponentProps<typeof TokenSelectorSheetModal>['onSearch']
  >(
    async ctx => {
      setQueryConds(prev => ({
        ...prev,
        ...(typeof ctx === 'string'
          ? { keyword: ctx }
          : {
              account: ctx.filterAccountItem ?? null,
              keyword: ctx.keyword,
              chainServerId: ctx.chainServerId ?? prev.chainServerId,
            }),
      }));
    },
    [setQueryConds],
  );

  const handleCurrentTokenChange = useCallback<
    React.ComponentProps<typeof TokenSelectorSheetModal>['onConfirm']
  >(
    t => {
      onChange && onChange('');
      onTokenChange(t);
      // Close the modal without triggering state update
      // The state update will be handled by handleTokenSelectorClose (via onCancel)
      // when the modal finishes closing, which avoids a race condition
      setTokenSelectorVisible(false, { noTriggerRerender: true });
    },
    [onChange, onTokenChange, setTokenSelectorVisible],
  );

  const handleTokenSelectorClose = useCallback(() => {
    //FIXME: snap to close will retrigger render
    setTimeout(() => {
      setTokenSelectorVisible(false);
    }, 0);
  }, [setTokenSelectorVisible]);

  const resetQueryConds = useCallback(() => {
    setQueryConds(prev => ({
      ...prev,
      chainServerId: chainId,
      account: accountInScreen,
    }));
  }, [chainId, accountInScreen]);

  const handleSelectToken = useCallback(() => {
    // if (allTokenItems.length > 0) {
    //   setUpdateNonce(prev => prev + 1);
    // }

    resetQueryConds();
    setTokenSelectorVisible(true);
  }, [resetQueryConds, setTokenSelectorVisible]);

  useRegressionScenarioComponentAction(
    'token-selector.swapTo.open',
    handleSelectToken,
  );
  useRegressionScenarioComponentAction(
    'token-selector.swapTo.close',
    handleTokenSelectorClose,
  );

  useEffect(() => {
    setQueryConds(prev => ({ ...prev, chainServerId: chainId }));
  }, [chainId]);

  useLayoutEffect(() => {
    setQueryConds(prev => ({ ...prev, account: accountInScreen }));
  }, [accountInScreen]);

  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (currentAccount?.address) {
          fetchUserTokenSettings();
        }
      })();
    }, [currentAccount?.address, fetchUserTokenSettings]),
  );

  const list = useMemo(() => {
    let filteredTokens = availableToken || [];

    if (favoriteFilterValue === 'favorite') {
      return favoriteTokens.map(e => ({
        ...e,
        isPin: true,
      }));
    }

    const tokensWithPinStatus = filteredTokens?.map(e => ({
      ...e,
      isPin: pinedQueue?.some(x => x.chainId === e.chain && x.tokenId === e.id),
    })) as ITokenItem[];

    return tokensWithPinStatus;
  }, [availableToken, favoriteFilterValue, favoriteTokens, pinedQueue]);

  const { forScene, ofScreen } = useScreenSceneAccountContext();
  const allowClearAccountFilter = useMemo(() => {
    if (
      queryConds.keyword ||
      !currentAccount?.type ||
      isWatchOrSafeAccount(currentAccount?.type)
    ) {
      return false;
    }

    return (
      forScene === 'MakeTransactionAbout' &&
      RootNames.MultiSwapBridge === ofScreen &&
      (type === 'bridgeFrom' || type === 'swapFrom')
    );
  }, [queryConds.keyword, currentAccount?.type, forScene, ofScreen, type]);

  const handleTokenChange = useMemoizedFn(async (tokenItem?: TokenItem) => {
    if (!tokenItem || !tokenItem.id) {
      return;
    }
    const res = await openapi.getTokenEntity(tokenItem.id, tokenItem.chain);
    setLongPressToken(prev => ({
      ...prev,
      tokenEntity: {
        ...tokenItem,
        identity: res,
      },
    }));
  });

  const tokenPressRef = useRef<typeof TouchableOpacity & View>(null);
  const handleLongPressToken = () => {
    if (!token) {
      return;
    }
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    handleTokenChange(token);
    tokenPressRef.current?.measureInWindow((x, y) => {
      tokenPressRef.current?.measure((_, __, ___, height) => {
        setLongPressToken(prev => ({
          ...prev,
          visible: true,
          tokenItem: token || null,
          position: { x, y, height },
        }));
      });
    });
  };

  useUnmount(() => {
    setLongPressToken({
      visible: false,
      tokenItem: null,
      position: { x: 0, y: 0, height: 0 },
      tokenEntity: null,
    });
  });

  return (
    <>
      <TouchableOpacity
        onPress={handleSelectToken}
        onLongPress={handleLongPressToken}
        ref={tokenPressRef}>
        <View style={[styles.wrapper, style]}>
          {token ? (
            <>
              <View style={styles.token}>
                <AssetAvatar
                  size={26}
                  chain={token.chain}
                  logo={token.logo_url}
                  chainSize={type === 'send' ? 12 : 0}
                />
                <Text numberOfLines={1} style={styles.tokenSymbol}>
                  {ellipsisOverflowedText(getTokenSymbol(token), 5)}
                </Text>
              </View>
              <RcIconSwapBottomArrow />
            </>
          ) : (
            <View style={styles.token}>
              <Text style={styles.selectText}>{t('page.bridge.Select')}</Text>
              <RcIconSwapBottomArrow />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <DeferredTokenSelectorSheetModal
        searchPlaceholder={searchPlaceholder}
        ref={tokenSelectorModalRef}
        visible={tokenSelectorVisible}
        unshiftList={[]}
        list={list}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        showFavoriteFilter={!hasSearchKeyword}
        favoriteFilterValue={favoriteFilterValue}
        onFavoriteFilterChange={setFavoriteFilterValue}
        type="swapTo"
        disableItemCheck={disableItemCheck}
        selectToken={token}
        placeholder={placeholder}
        displayAccountFilter={allowClearAccountFilter}
        filterAccount={queryConds.account}
        chainServerId={queryConds.chainServerId}
        disabledTips={'Not supported'}
        supportChains={supportChains}
        hideChainFilter={true}
        showTestNetSwitch={false}
      />
    </>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 100,
    // TODO: backgroundColor: colors2024['neutral-card-2'],
    backgroundColor: colors2024['neutral-line'],
    // backgroundColor: colors2024['neutral-bg-2'],

    // paddingLeft: 16,
    // paddingRight: 12,
    padding: 4,
    height: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bridgeWrapper: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentItemWrapper: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 8,
    paddingRight: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  token: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    lineHeight: 20,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  headerBoxNoPb: {
    paddingBottom: 0,
  },
  headerBoxText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  selectText: {
    paddingLeft: 12,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));

export default SwapToTokenSelect;
