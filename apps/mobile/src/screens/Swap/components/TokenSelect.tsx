import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
} from 'react';
import { View, Text } from 'react-native';

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
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';

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
  type = 'default',
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
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <TouchableView onPress={handleSelectToken}>
        <View style={styles.wrapper}>
          {token ? (
            <>
              <View style={styles.token}>
                <AssetAvatar
                  size={24}
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
              <Text style={styles.selectText}>
                {t('page.swap.select-token')}
              </Text>
              <RcIconSwapBottomArrow />
            </>
          )}
        </View>
      </TouchableView>

      <TokenSelectorSheetModal
        visible={tokenSelectorVisible}
        list={displayTokenList}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        type={type}
        placeholder={placeholder}
        chainServerId={queryConds.chainServerId}
        disabledTips={'Not supported'}
        supportChains={SWAP_SUPPORT_CHAINS}
      />
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  wrapper: {
    borderRadius: 4,
    backgroundColor: colors['neutral-card-2'],
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  token: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors['neutral-title1'],
    flex: 1,
  },
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors['neutral-title1'],
  },
}));

export default TokenSelect;
