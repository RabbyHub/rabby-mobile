import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import { isSwapTokenType } from '@/components/Token/TokenSelectorSheetModal';
import useAsync from 'react-use/lib/useAsync';
import { useSortToken, useTokens } from '@/hooks/chainAndToken/useToken';
import { useCurrentAccount } from '@/hooks/account';
import { abstractTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import useSearchToken from '@/hooks/chainAndToken/useSearchToken';
import { openapi } from '@/core/request';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  chainId: string;
  useSwapTokenList?: boolean;
  excludeTokens?: TokenItem['id'][];
  type?: 'from' | 'to';
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
  type = 'from',
  placeholder,
  hideChainIcon = true,
  value,
  loading = false,
  tokenRender,
  useSwapTokenList = false,
}: TokenSelectProps) => {
  const [queryConds, setQueryConds] = useState({
    keyword: '',
    chainServerId: chainId,
  });
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);
  const [updateNonce, setUpdateNonce] = useState(0);

  const isSwapType = isSwapTokenType(type);

  const { currentAccount } = useCurrentAccount();

  // when no any queryConds
  const { tokens: allTokens, isLoading: isLoadingAllTokens } = useTokens(
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

  const allDisplayTokens = useMemo(() => {
    if (useSwapTokenList) {
      return swapTokenList || [];
    }
    return allTokens.map(abstractTokenToTokenItem);
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

  const displayTokenList = useSortToken(availableToken);

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

  return (
    <>
      <TouchableOpacity onPress={handleSelectToken} style={styles.wrapper}>
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
                {getTokenSymbol(token)}
              </Text>
            </View>
            <RcIconSwapBottomArrow />
          </>
        ) : (
          <>
            <Text style={styles.selectText}>{t('page.swap.select-token')}</Text>
            <RcIconSwapBottomArrow />
          </>
        )}
      </TouchableOpacity>

      <TokenSelectorSheetModal
        visible={tokenSelectorVisible}
        list={displayTokenList}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        hideChainFilter={true}
        headerTitle={
          <View style={styles.headerBox}>
            <Text style={styles.headerBoxText}>Token</Text>
            <Text style={styles.headerBoxText}>Vaue</Text>
          </View>
        }
        value={token}
        type={'bridgeFrom'}
        placeholder={placeholder}
        chainServerId={queryConds.chainServerId}
        disabledTips={'Not supported'}
        supportChains={SWAP_SUPPORT_CHAINS}
      />
    </>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBox: {
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // borderTopWidth: 0,
    backgroundColor: colors2024['neutral-bg-1'],
    // borderBottomWidth: 0.5,
    borderWidth: 1,
    marginHorizontal: 24,
    // borderTopColor: 'transparent',
    borderColor: colors2024['neutral-line'],
  },
  headerBoxText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
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
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));

export default TokenSelect;
