import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { omit, uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import { isSwapTokenType } from '@/components/Token/TokenSelectorSheetModal';
import useAsync from 'react-use/lib/useAsync';
import { useSortToken, useTokens } from '@/hooks/chainAndToken/useToken';
import { useCurrentAccount } from '@/hooks/account';
import {
  abstractTokenToTokenItem,
  getTokenSymbol,
  SMALL_TOKEN_ID,
} from '@/utils/token';
import useSearchToken from '@/hooks/chainAndToken/useSearchToken';
import { openapi } from '@/core/request';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { convertSmallTokenList } from '@/screens/Home/utils/converAssets';
import { ellipsisOverflowedText } from '@/utils/text';
import { useSwapRecentToTokens } from '../hooks/recent';
import { preferenceService } from '@/core/services';
import {
  ensureAbstractPortfolioToken,
  tagTokenList,
} from '@/screens/Home/utils/token';
import { CHAINS_ENUM } from '@debank/common';
import LinearGradient from 'react-native-linear-gradient';
interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
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
const TokenSelect = forwardRef<
  { openTokenModal: React.Dispatch<React.SetStateAction<boolean>> },
  TokenSelectProps
>(
  (
    {
      token,
      onChange,
      onTokenChange,
      chainId,
      excludeTokens = defaultExcludeTokens,
      type = 'send',
      placeholder,
      hideChainIcon = true,
      value,
      loading = false,
      tokenRender,
      useSwapTokenList = false,
      supportChains,
      searchPlaceholder,
    },
    ref,
  ) => {
    const [fold, setFold] = useState(true);
    const [queryConds, setQueryConds] = useState({
      keyword: '',
      chainServerId: chainId,
    });
    const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);
    const [updateNonce, setUpdateNonce] = useState(0);

    const isSwapType = isSwapTokenType(type);

    useImperativeHandle(ref, () => ({
      openTokenModal: setTokenSelectorVisible,
    }));

    const { currentAccount } = useCurrentAccount();

    // when no any queryConds
    const { tokens: _allTokens, isLoading: isLoadingAllTokens } = useTokens(
      useSwapTokenList ? undefined : currentAccount?.address,
      tokenSelectorVisible,
      updateNonce,
      queryConds.chainServerId,
      true,
    );

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

    const allTokens = useSortToken(_allTokens);

    const allDisplayTokens = useMemo(() => {
      if (useSwapTokenList) {
        return swapTokenList || [];
      }
      return allTokens.filter(i => !i._isFold).map(abstractTokenToTokenItem);
    }, [allTokens, swapTokenList, useSwapTokenList]);

    const { isLoading: isSearchLoading, list: searchedTokenByQuery } =
      useSearchToken(
        {
          address: currentAccount?.address,
          keyword: queryConds.keyword,
          chainServerId: queryConds.chainServerId,
        },
        {
          withBalance: isSwapType ? false : true,
        },
      );

    const availableToken = useMemo(() => {
      const allTokens = queryConds.chainServerId
        ? allDisplayTokens.filter(
            token => token.chain === queryConds.chainServerId,
          )
        : allDisplayTokens;
      return uniqBy(
        queryConds.keyword
          ? searchedTokenByQuery.map(abstractTokenToTokenItem)
          : allTokens,
        token => {
          return `${token.chain}-${token.id}`;
        },
      ).filter(e => !excludeTokens.includes(e.id));
    }, [allDisplayTokens, searchedTokenByQuery, excludeTokens, queryConds]);

    const isFromModalType = useMemo(
      () => type === 'swapFrom' || type === 'bridgeFrom' || type === 'send',
      [type],
    );

    const foldTokensList = useMemo(() => {
      if (!isFromModalType) {
        return [];
      }

      const list = convertSmallTokenList(
        allTokens.filter(
          i => i._isFold && i.chain === queryConds.chainServerId,
        ),
      ).map(abstractTokenToTokenItem);
      return list.filter(e => !excludeTokens.includes(e.id));
    }, [allTokens, excludeTokens, isFromModalType, queryConds.chainServerId]);

    const isListLoading = queryConds.keyword
      ? isSearchLoading
      : useSwapTokenList
      ? swapTokenListLoading
      : isLoadingAllTokens;

    const handleSearchTokens = useCallback(
      async ctx => {
        setQueryConds({
          keyword: ctx.keyword,
          chainServerId: ctx.chainServerId,
        });
      },
      [setQueryConds],
    );

    const handleCurrentTokenChange = useCallback(
      token => {
        onChange && onChange('');
        onTokenChange(token);
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

    const handleSelectToken = useCallback(() => {
      if (allDisplayTokens.length > 0) {
        setUpdateNonce(updateNonce + 1);
      }
      setTokenSelectorVisible(true);
    }, [allDisplayTokens, updateNonce]);

    useEffect(() => {
      setQueryConds(prev => ({
        ...prev,
        chainServerId: chainId,
      }));
    }, [chainId]);

    const { t } = useTranslation();
    const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
    const [recentToTokens] = useSwapRecentToTokens();

    const recentDisplayToTokens = useMemo(() => {
      if (type === 'swapTo' && queryConds.keyword.length < 1) {
        return recentToTokens.filter(item => {
          return item.chain === chainId && !excludeTokens?.includes(item.id);
        });
      }
      return [];
    }, [
      type,
      queryConds.keyword.length,
      recentToTokens,
      chainId,
      excludeTokens,
    ]);

    const { value: pinedQueue } = useAsync(async () => {
      if (currentAccount?.address) {
        const data = await preferenceService.getUserTokenSettings();
        return data?.pinedQueue || [];
      }
      return [];
    });

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
        <View style={styles.headerBox}>
          <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
          <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
        </View>
      );
    }, [styles.headerBox, styles.headerBoxText, swapToHeader, t, type]);

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
              TokenRender: ({ token }: { token: TokenItem }) => {
                return (
                  <View style={styles.recentItemWrapper}>
                    <AssetAvatar
                      size={26}
                      chain={token.chain}
                      logo={token.logo_url}
                    />
                    <Text numberOfLines={1} style={styles.tokenSymbol}>
                      {ellipsisOverflowedText(getTokenSymbol(token), 5)}
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

    return (
      <>
        <TouchableOpacity onPress={handleSelectToken}>
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
                    chainSize={0}
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
          chainServerId={queryConds.chainServerId}
          disabledTips={'Not supported'}
          supportChains={supportChains}
          hideChainFilter={type === 'swapFrom' ? false : true}
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
