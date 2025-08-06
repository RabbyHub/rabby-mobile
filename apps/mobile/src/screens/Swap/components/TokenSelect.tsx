import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';

import { uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import useAsync from 'react-use/lib/useAsync';
import { useSortToken } from '@/hooks/chainAndToken/useToken';
import {
  abstractTokenToTokenItem,
  DisplayedToken,
  getTokenSymbol,
} from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { convertSmallTokenList } from '@/screens/Home/utils/converAssets';
import { ellipsisOverflowedText } from '@/utils/text';
import { customTestnetService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { Account } from '@/core/services/preference';
import {
  makeKeyForTokenItemMaybeWithOwner,
  TokenItemMaybeWithOwner,
} from '@/databases/hooks/token';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import useDebounceValue from '@/hooks/common/useDebounceValue';
import { useScreenSceneAccountContext } from '@/hooks/accountsSwitcher';
import { RootNames } from '@/constant/layout';
import { isWatchOrSafeAccount } from '@/utils/account';
import { useLongPressTokenAtom } from '../hooks';
import { useMemoizedFn, useUnmount } from 'ahooks';
import { useFocusEffect } from '@react-navigation/native';
import { useSelectTokens } from '../hooks/useSelectTokens';
import { useSwitchNetTab } from '@/components2024/PillsSwitch/NetSwitchTabs';
import { useSearchTestnetToken } from '@/hooks/chainAndToken/useSearchTestnetToken';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { FavoriteFilterType } from '@/components/Token/FavoriteFilterItem';
import { useAtom } from 'jotai';

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  accountInScreen?: Account | null;
  chainId: string;
  useSwapTokenList?: boolean;
  excludeTokens?: TokenItem['id'][];
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
        token?: TokenItem;
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
const TokenSelect = forwardRef<TokenSelectInst, TokenSelectProps>(
  (
    {
      token,
      onChange,
      onTokenChange,
      accountInScreen,
      chainId,
      excludeTokens = defaultExcludeTokens,
      type = 'send',
      placeholder,
      useSwapTokenList = false,
      supportChains,
      searchPlaceholder,
      disableItemCheck,
    },
    ref,
  ) => {
    const [_queryConds, setQueryConds] = useState<QueryConditions>({
      keyword: '',
      account: accountInScreen,
      chainServerId: chainId,
    });

    const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);
    const [updateNonce, setUpdateNonce] = useState(0);
    const [favoriteFilterValue, setFavoriteFilterValue] =
      useState<FavoriteFilterType>('all');

    const [_, setLongPressToken] = useLongPressTokenAtom();
    const queryConds = useDebounceValue(_queryConds, 250);
    const timeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentAccount = queryConds.account;
    const {
      tokens,
      getCacheTop10Tokens,
      getCacheTokens,
      checkIsExpireAndUpdate,
      loadToken,
      isLoading: isLoadingAllTokens,
    } = useSelectTokens({
      currentAccount,
      visible: tokenSelectorVisible,
      keyword: queryConds.keyword,
      chain_server_id: queryConds.chainServerId,
      type: type,
    });

    const isSwapTo = type === 'swapTo';

    useImperativeHandle(ref, () => ({
      openTokenModal: conds => {
        setQueryConds(prev => ({ ...prev, ...conds }));
        setTokenSelectorVisible(true);
      },
    }));

    // fetch tokens
    useEffect(() => {
      (async () => {
        if (timeRef.current) {
          clearTimeout(timeRef.current);
          timeRef.current = null;
        }
        if (!tokenSelectorVisible) {
          return;
        }
        if (!tokens.length) {
          if (type === 'send') {
            currentAccount?.address &&
              (await getCacheTokens([currentAccount.address]));
          } else {
            await getCacheTop10Tokens();
          }
        }
        timeRef.current = setTimeout(() => {
          if (currentAccount?.address) {
            loadToken(currentAccount.address, true);
          } else {
            checkIsExpireAndUpdate();
          }
        }, 500);
      })();
      return () => {
        if (timeRef.current) {
          clearTimeout(timeRef.current);
          timeRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenSelectorVisible, currentAccount?.address, useSwapTokenList]);

    // swap token list
    const { value: swapTokenList, loading: swapTokenListLoading } =
      useAsync(async () => {
        if (!currentAccount || !useSwapTokenList || !tokenSelectorVisible) {
          return [];
        }
        const list = await openapi.getSwapTokenList(
          currentAccount.address,
          queryConds.chainServerId ? queryConds.chainServerId : undefined,
        );
        return list;
      }, [
        queryConds.chainServerId,
        currentAccount,
        useSwapTokenList,
        tokenSelectorVisible,
      ]);

    const allRemoteTokens = useSortToken(tokens, accountInScreen);

    const searchedLocalTokensWithOwner = useMemo(
      () =>
        (isSwapTo || type === 'bridgeFrom' || type === 'swapFrom') &&
        queryConds.keyword
          ? tokens
          : tokens.map(
              e =>
                ({
                  ...abstractTokenToTokenItem(e),
                  ownerAccount:
                    'ownerAccount' in e ? e.ownerAccount : undefined,
                } as TokenItemMaybeWithOwner),
            ),
      [isSwapTo, queryConds.keyword, tokens, type],
    );

    const { isSearchLoading, allTokens, searchedTokenByQuery, allTokenItems } =
      useMemo(() => {
        return {
          isSearchLoading: isLoadingAllTokens,
          allTokens: allRemoteTokens,
          allTokenItems: useSwapTokenList
            ? swapTokenList || []
            : searchedLocalTokensWithOwner,
          searchedTokenByQuery: searchedLocalTokensWithOwner,
        };
      }, [
        isLoadingAllTokens,
        allRemoteTokens,
        useSwapTokenList,
        swapTokenList,
        searchedLocalTokensWithOwner,
      ]);

    const isExcludedTokens = useCallback(
      (e: AbstractPortfolioToken | TokenItemMaybeWithOwner) => {
        return !!excludeTokens?.includes(
          e instanceof DisplayedToken ? e._tokenId : e.id,
        );
      },
      [excludeTokens],
    );

    const isFromModalType = useMemo(
      () => type === 'swapFrom' || type === 'bridgeFrom' || type === 'send',
      [type],
    );

    const { userTokenSettings, fetchUserTokenSettings } =
      useUserTokenSettings();
    const pinedQueue = useMemo(
      () => userTokenSettings.pinedQueue,
      [userTokenSettings.pinedQueue],
    );

    const foldTokensList = useMemo(() => {
      if (!isFromModalType || queryConds.keyword) {
        return [];
      }

      let filteredTokens = allTokens.filter(i => {
        const condition = !!i._isFold || (!i.is_core && !i._isPined);
        return condition;
      });

      if (favoriteFilterValue === 'favorite') {
        filteredTokens = filteredTokens.filter(token =>
          pinedQueue?.some(
            x => x.chainId === token.chain && x.tokenId === token._tokenId,
          ),
        );
      }

      const list = convertSmallTokenList(filteredTokens).map(
        e =>
          ({
            ...abstractTokenToTokenItem(e),
            ownerAccount: 'ownerAccount' in e ? e.ownerAccount : undefined,
          } as TokenItemMaybeWithOwner),
      );
      return uniqBy(
        list.filter(e => !isExcludedTokens(e)),
        e => makeKeyForTokenItemMaybeWithOwner(e),
      );
    }, [
      allTokens,
      isExcludedTokens,
      isFromModalType,
      queryConds.keyword,
      favoriteFilterValue,
      pinedQueue,
    ]);

    const availableToken = useMemo(() => {
      const _tokens = queryConds.chainServerId
        ? allTokenItems.filter(t => t.chain === queryConds.chainServerId)
        : allTokenItems;
      return uniqBy(queryConds.keyword ? searchedTokenByQuery : _tokens, t => {
        return makeKeyForTokenItemMaybeWithOwner(t);
      }).filter((e: TokenItemMaybeWithOwner) => {
        const res =
          !isExcludedTokens(e) &&
          !foldTokensList.some(f => {
            return (
              f.chain === e.chain &&
              f.id === e.id &&
              f?.ownerAccount?.address.toLowerCase() ===
                e?.ownerAccount?.address.toLowerCase()
            );
          });
        return res;
      });
    }, [
      queryConds.chainServerId,
      queryConds.keyword,
      allTokenItems,
      searchedTokenByQuery,
      isExcludedTokens,
      foldTokensList,
    ]);

    const isListLoading = queryConds.keyword
      ? isSearchLoading
      : useSwapTokenList
      ? swapTokenListLoading
      : isLoadingAllTokens;

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
        setTokenSelectorVisible(false);
      },
      [onChange, onTokenChange],
    );

    const handleTokenSelectorClose = useCallback(() => {
      //FIXME: snap to close will retrigger render
      setTimeout(() => {
        setTokenSelectorVisible(false);
      }, 0);
    }, []);

    const resetQueryConds = useCallback(() => {
      setQueryConds(prev => ({
        ...prev,
        chainServerId: chainId,
        account: accountInScreen,
      }));
    }, [chainId, accountInScreen]);

    const handleSelectToken = useCallback(() => {
      if (allTokenItems.length > 0) {
        setUpdateNonce(updateNonce + 1);
      }

      resetQueryConds();
      setTokenSelectorVisible(true);
    }, [allTokenItems, updateNonce, resetQueryConds]);

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
      let filteredTokens = availableToken;

      if (favoriteFilterValue === 'favorite') {
        filteredTokens = availableToken.filter(token =>
          pinedQueue?.some(
            x => x.chainId === token.chain && x.tokenId === token.id,
          ),
        );
      }

      const tokensWithPinStatus = filteredTokens.map(e => ({
        ...e,
        isPined: pinedQueue?.some(
          x => x.chainId === e.chain && x.tokenId === e.id,
        ),
      })) as TokenItem[];

      return tokensWithPinStatus;
    }, [availableToken, pinedQueue, favoriteFilterValue]);

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
        ((RootNames.MultiBridge === ofScreen && type === 'bridgeFrom') ||
          (RootNames.MultiSwap === ofScreen && type === 'swapFrom'))
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

    const isSend = type === 'send';

    const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
      hideTestnetTab: !isSend || customTestnetService.getList().length === 0,
    });

    const {
      testnetTokenList: rawTestnetTokenList,
      loading: testnetTokenListLoading,
    } = useSearchTestnetToken({
      address: currentAccount?.address,
      withBalance: false,
      q: queryConds.keyword,
      enabled: selectedTab === 'testnet' && isSend,
    });

    const testnetTokenList = useMemo(() => {
      if (favoriteFilterValue === 'favorite') {
        return rawTestnetTokenList.filter(token =>
          pinedQueue?.some(
            x => x.chainId === token.chain && x.tokenId === token.id,
          ),
        );
      }
      return rawTestnetTokenList;
    }, [rawTestnetTokenList, favoriteFilterValue, pinedQueue]);

    return (
      <>
        <TouchableOpacity
          onPress={handleSelectToken}
          onLongPress={handleLongPressToken}
          ref={tokenPressRef}>
          <View
            style={
              type === 'bridgeFrom' ? styles.bridgeWrapper : styles.wrapper
            }>
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

        <TokenSelectorSheetModal
          searchPlaceholder={searchPlaceholder}
          visible={tokenSelectorVisible}
          unshiftList={[]}
          list={selectedTab === 'testnet' ? testnetTokenList : list}
          foldTokensList={selectedTab === 'testnet' ? [] : foldTokensList}
          onConfirm={handleCurrentTokenChange}
          onCancel={handleTokenSelectorClose}
          onSearch={handleSearchTokens}
          isLoading={
            selectedTab === 'testnet' ? testnetTokenListLoading : isListLoading
          }
          showFavoriteFilter
          favoriteFilterValue={favoriteFilterValue}
          onFavoriteFilterChange={setFavoriteFilterValue}
          type={type}
          disableItemCheck={disableItemCheck}
          selectToken={token}
          placeholder={placeholder}
          displayAccountFilter={allowClearAccountFilter}
          filterAccount={queryConds.account}
          chainServerId={queryConds.chainServerId}
          disabledTips={'Not supported'}
          supportChains={supportChains}
          hideChainFilter={type === 'swapFrom' ? false : true}
          showTestNetSwitch={isShowTestnet}
          selectTab={selectedTab}
          onTabChange={onTabChange}
        />
      </>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 12,
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

export default TokenSelect;
