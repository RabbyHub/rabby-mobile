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

import { omit, uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
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
import { useSwapRecentToTokens } from '../hooks/recent';
import { preferenceService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { Account, IManageToken } from '@/core/services/preference';
import {
  makeKeyForTokenItemMaybeWithOwner,
  TokenItemMaybeWithOwner,
  useQueryLocalTokens,
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

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  accountInScreen?: Account | null;
  chainId: string;
  useSwapTokenList?: boolean;
  excludeTokens?: TokenItem['id'][];
  type?: ComponentProps<typeof TokenSelectorSheetModal>['type'];
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
  supportChains: CHAINS_ENUM[];
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
    },
    ref,
  ) => {
    const [fold, setFold] = useState(true);
    const [pinedQueue, setPinedQueue] = useState<IManageToken[]>([]);
    const [_queryConds, setQueryConds] = useState<QueryConditions>({
      keyword: '',
      account: accountInScreen,
      chainServerId: chainId,
    });

    const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);
    const [updateNonce, setUpdateNonce] = useState(0);
    const [_, setLongPressToken] = useLongPressTokenAtom();
    const queryConds = useDebounceValue(_queryConds, 250);
    // settimoutout ref
    const timeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentAccount = queryConds.account;
    const {
      tokens,
      tokenWithOwner,
      getCacheTop10Tokens,
      checkIsExpireAndUpdate,
      loadToken,
      isLoading: isLoadingAllTokens,
    } = useSelectTokens({
      currentAddress: currentAccount?.address.toLocaleLowerCase(),
      visible: tokenSelectorVisible,
      keyword: queryConds.keyword,
      chain_server_id: queryConds.chainServerId,
    });

    useImperativeHandle(ref, () => ({
      openTokenModal: conds => {
        setQueryConds(prev => ({ ...prev, ...conds }));
        setTokenSelectorVisible(true);
      },
    }));

    // fetch tokens
    useEffect(() => {
      if (timeRef.current) {
        clearTimeout(timeRef.current);
        timeRef.current = null;
      }
      if (!tokenSelectorVisible || useSwapTokenList) {
        return;
      }
      if (!tokens.length) {
        getCacheTop10Tokens();
      }
      timeRef.current = setTimeout(() => {
        if (currentAccount?.address) {
          loadToken(currentAccount.address, true);
        } else {
          checkIsExpireAndUpdate();
        }
      }, 500);
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
    const allRemoteTokens = useSortToken(tokens);

    const searchedLocalTokensWithOwner = useMemo(
      () =>
        tokenWithOwner.map(
          e =>
            ({
              ...abstractTokenToTokenItem(e),
              ownerAccount: 'ownerAccount' in e ? e.ownerAccount : undefined,
            } as TokenItemMaybeWithOwner),
        ),
      [tokenWithOwner],
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

    const foldTokensList = useMemo(() => {
      if (!isFromModalType || queryConds.keyword) {
        return [];
      }

      const list = convertSmallTokenList(
        allTokens.filter(i => {
          const condition = !!i._isFold || (!i.is_core && !i._isPined);
          if (queryConds.chainServerId) {
            return condition && i.chain === queryConds.chainServerId;
          }
          return condition;
        }),
      ).map(
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
      queryConds.chainServerId,
      queryConds.keyword,
    ]);

    const availableToken = useMemo(() => {
      const _tokens = queryConds.chainServerId
        ? allTokenItems.filter(t => t.chain === queryConds.chainServerId)
        : allTokenItems;
      return uniqBy(queryConds.keyword ? searchedTokenByQuery : _tokens, t => {
        return makeKeyForTokenItemMaybeWithOwner(t);
      }).filter(
        (e: TokenItemMaybeWithOwner) =>
          !isExcludedTokens(e) &&
          !foldTokensList.some(f => {
            return (
              f.chain === e.chain &&
              f.id === e.id &&
              f?.ownerAccount?.address.toLowerCase() ===
                e?.ownerAccount?.address.toLowerCase()
            );
          }),
      );
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
    const [recentToTokens] = useSwapRecentToTokens();

    const recentDisplayToTokens = useMemo(() => {
      if (type === 'swapTo' && queryConds.keyword.length < 1) {
        return recentToTokens.filter(item => {
          return item.chain === chainId && !isExcludedTokens(item);
        });
      }
      return [];
    }, [
      type,
      queryConds.keyword.length,
      recentToTokens,
      chainId,
      isExcludedTokens,
    ]);

    // const { value: pinedQueue } = useAsync(async () => {
    //   if (currentAccount?.address) {
    //     const data = await preferenceService.getUserTokenSettings();
    //     return data?.pinedQueue || [];
    //   }
    //   return [];
    // });

    useFocusEffect(
      useCallback(() => {
        (async () => {
          if (currentAccount?.address) {
            const data = await preferenceService.getUserTokenSettings();
            setPinedQueue(data?.pinedQueue || []);
          }
        })();
      }, [currentAccount?.address]),
    );

    const swapToHeader = useMemo(() => {
      return (
        <View style={[styles.headerBox]}>
          <Text style={styles.headerBoxText}>
            {t('component.TokenSelector.common')}
          </Text>
          <Text style={styles.headerBoxText}>
            <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
          </Text>
        </View>
      );
    }, [styles.headerBox, styles.headerBoxText, t]);

    const headerTitle = useMemo(() => {
      if (type === 'swapTo') {
        return swapToHeader;
      }
      return (
        <View style={[styles.headerBox, styles.headerBoxNoPb]}>
          <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
          <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
        </View>
      );
    }, [
      styles.headerBox,
      styles.headerBoxNoPb,
      styles.headerBoxText,
      swapToHeader,
      t,
      type,
    ]);

    const recentTitle = useMemo(() => {
      if (recentDisplayToTokens.length) {
        return (
          <View style={styles.headerBox}>
            <Text style={styles.headerBoxText}>
              {t('component.TokenSelector.recent')}
            </Text>
          </View>
        );
      }
      return null;
    }, [recentDisplayToTokens, t, styles.headerBox, styles.headerBoxText]);

    const list = useMemo(() => {
      if (pinedQueue?.length) {
        return [
          ...availableToken
            .map(e => ({
              ...e,
              isPined: pinedQueue?.some(
                x => x.chainId === e.chain && x.tokenId === e.id,
              ),
              pinIndex: pinedQueue?.findIndex(
                x => x.chainId === e.chain && x.tokenId === e.id,
              ),
            }))
            .sort((a, b) => {
              if (a.pinIndex > -1 && b.pinIndex > -1) {
                return a.pinIndex - b.pinIndex;
              }

              const a1 = a.isPined ? 1 : 0;
              const b1 = b.isPined ? 1 : 0;
              return b1 - a1;
            }),
        ] as TokenItem[];
      }

      return [...availableToken];
    }, [availableToken, pinedQueue]);

    const unshiftList = useMemo(() => {
      if (recentDisplayToTokens.length) {
        const recentObj = {
          header: () => recentTitle,
          data: [
            {
              _chain: 'swapToRecentList',
              recentList: recentDisplayToTokens.map(e => ({
                ...omit(e, ['isPined', 'pinIndex']),
                group: 'recent',
              })),
              TokenRender: ({ token: _token }: { token: TokenItem }) => {
                return (
                  <View style={styles.recentItemWrapper}>
                    <AssetAvatar
                      size={26}
                      chain={_token.chain}
                      logo={_token.logo_url}
                    />
                    <Text numberOfLines={1} style={styles.tokenSymbol}>
                      {ellipsisOverflowedText(getTokenSymbol(_token), 5)}
                    </Text>
                  </View>
                );
              },
            } as any as TokenItem,
          ],
        };

        return [recentObj];
      }
      return;
    }, [
      recentDisplayToTokens,
      recentTitle,
      styles.recentItemWrapper,
      styles.tokenSymbol,
    ]);

    const { forScene, ofScreen } = useScreenSceneAccountContext();
    const allowClearAccountFilter = useMemo(() => {
      if (!currentAccount?.type || isWatchOrSafeAccount(currentAccount?.type)) {
        return false;
      }

      return (
        forScene === 'MakeTransactionAbout' &&
        ((RootNames.MultiBridge === ofScreen && type === 'bridgeFrom') ||
          (RootNames.MultiSwap === ofScreen && type === 'swapFrom') ||
          (RootNames.MultiSend === ofScreen && type === 'send'))
      );
    }, [forScene, ofScreen, currentAccount?.type, type]);

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

    const tokenPressRef = useRef<TouchableOpacity>(null);
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
          unshiftList={unshiftList}
          list={list}
          foldTokensList={foldTokensList}
          onConfirm={handleCurrentTokenChange}
          onCancel={handleTokenSelectorClose}
          onSearch={handleSearchTokens}
          isLoading={isListLoading}
          type={type}
          selectToken={token}
          placeholder={placeholder}
          headerTitle={headerTitle}
          displayAccountFilter={allowClearAccountFilter}
          filterAccount={queryConds.account}
          chainServerId={queryConds.chainServerId}
          disabledTips={'Not supported'}
          supportChains={supportChains}
          hideChainFilter={
            type === 'swapFrom' || type === 'send' ? false : true
          }
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
