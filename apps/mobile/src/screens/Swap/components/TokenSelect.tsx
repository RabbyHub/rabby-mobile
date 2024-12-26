import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
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
}
const defaultExcludeTokens = [];
const TokenSelect = ({
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
}: TokenSelectProps) => {
  const [fold, setFold] = useState(true);
  const [queryConds, setQueryConds] = useState({
    keyword: '',
    chainServerId: chainId,
  });
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);
  const [updateNonce, setUpdateNonce] = useState(0);

  const isSwapType = isSwapTokenType(type);

  const { currentAccount } = useCurrentAccount();

  // when no any queryConds
  const { tokens: _allTokens, isLoading: isLoadingAllTokens } = useTokens(
    useSwapTokenList ? undefined : currentAccount?.address,
    undefined,
    tokenSelectorVisible,
    updateNonce,
    queryConds.chainServerId,
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
      allTokens.filter(i => i._isFold && i.chain === queryConds.chainServerId),
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
  const { styles } = useTheme2024({ getStyle });
  const [recentToTokens] = useSwapRecentToTokens();

  const recentDisplayToTokens = useMemo(() => {
    if (type === 'swapTo' && queryConds.keyword.length < 1) {
      return recentToTokens.filter(item => {
        return item.chain === chainId && !excludeTokens?.includes(item.id);
      });
    }
    return [];
  }, [type, queryConds.keyword.length, recentToTokens, chainId, excludeTokens]);

  const { value: tokenSettings } = useAsync(async () => {
    if (currentAccount?.address) {
      const data = await preferenceService.getUserTokenSettings(
        currentAccount?.address,
      );
      return data || {};
    }
    return {};
  });

  const swapToHeader = useMemo(() => {
    return (
      <View
        style={[
          styles.headerBox,
          recentDisplayToTokens ? { marginTop: 16 } : [],
        ]}>
        <Text style={styles.headerBoxText}>
          {t('component.TokenSelector.hot')}
        </Text>
        <Text style={styles.headerBoxText}>
          <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
        </Text>
      </View>
    );
  }, [styles.headerBox, styles.headerBoxText, t, recentDisplayToTokens]);

  const headerTitle = useMemo(() => {
    if (recentDisplayToTokens.length) {
      return (
        <View style={styles.headerBox}>
          <Text style={styles.headerBoxText}>
            {t('component.TokenSelector.bridge.token')}
          </Text>
          <Text style={styles.headerBoxText}>
            {t('component.TokenSelector.recent')}
          </Text>
        </View>
      );
    }
    if (type === 'swapTo') {
      return swapToHeader;
    }
    return (
      <View style={styles.headerBox}>
        <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
        <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
      </View>
    );
  }, [
    recentDisplayToTokens.length,
    styles.headerBox,
    styles.headerBoxText,
    swapToHeader,
    t,
    type,
  ]);

  const list = useMemo(() => {
    if (recentDisplayToTokens.length) {
      if (tokenSettings) {
        const { pinedQueue } = tokenSettings;
        return [
          ...recentDisplayToTokens.map(e => ({
            ...omit(e, ['isPined', 'pinIndex']),
            group: 'recent',
          })),
          {
            id: 'swapTo header',
            _chain: 'swapTo',
            headerRender: () => swapToHeader,
          },
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
              if (a.pinIndex && b.pinIndex) {
                return a.pinIndex - b.pinIndex;
              }
              if (a.isPined) {
                return -1;
              }
              if (b.isPined) {
                return 1;
              }
              return 0;
            }),
        ] as TokenItem[];
      }

      return [
        ...recentDisplayToTokens.map(e => ({
          ...omit(e, ['isPined', 'pinIndex']),
          group: 'recent',
        })),
        {
          id: 'swapTo header',
          _chain: 'swapTo',
          headerRender: () => swapToHeader,
        },
        ...availableToken,
      ] as TokenItem[];
    }
    return availableToken;
  }, [availableToken, recentDisplayToTokens, swapToHeader, tokenSettings]);

  return (
    <>
      <TouchableOpacity onPress={handleSelectToken}>
        <View
          style={type === 'bridgeFrom' ? styles.bridgeWrapper : styles.wrapper}>
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
            <>
              <Text style={styles.selectText}>{t('page.bridge.Select')}</Text>
              <RcIconSwapBottomArrow />
            </>
          )}
        </View>
      </TouchableOpacity>

      <TokenSelectorSheetModal
        visible={tokenSelectorVisible}
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
        supportChains={SWAP_SUPPORT_CHAINS}
        hideChainFilter={type === 'swapFrom' ? false : true}
      />
    </>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
  token: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  headerBox: {
    // paddingHorizontal: 16,
    // height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // borderTopWidth: 0,
    backgroundColor: colors2024['neutral-bg-1'],
    // borderBottomWidth: 0.5,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  headerBoxText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  selectText: {
    padding: 4,
    paddingLeft: 12,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));

export default TokenSelect;
