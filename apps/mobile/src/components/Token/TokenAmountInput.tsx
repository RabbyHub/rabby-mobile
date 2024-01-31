import React, {
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import RcArrowDownCC from './icons/token-selector-trigger-down-cc.svg';
import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { useTokens } from '@/hooks/chainAndToken/useToken';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { abstractTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import useSearchToken from '@/hooks/chainAndToken/useSearchToken';
import { uniqBy } from 'lodash';
import {
  TokenSelectorProps,
  TokenSelectorSheetModal,
} from './TokenSelectorSheetModal';
import { AssetAvatar } from '../AssetAvatar';
import { useSortTokenPure } from '@/screens/Home/hooks/useSortTokens';
import { devLog } from '@/utils/logger';

const RcArrowDown = makeThemeIconFromCC(RcArrowDownCC, 'neutral-foot');

function useLoadTokenList({
  externalChainServerId,
  excludeTokens = [],
  onTokenChange,
  onChange,
}: {
  externalChainServerId?: string;
  excludeTokens?: TokenItem['id'][];
  onTokenChange?: TokenAmountInputProps['onTokenChange'];
  onChange?: TokenAmountInputProps['onChange'];
} = {}) {
  const { currentAccount } = useCurrentAccount();
  const [keyword, setKeyword] = useState('');
  const [chainServerId, setChainServerId] = useState(externalChainServerId);

  const tokenInputRef = useRef<TextInput>(null);
  const [updateNonce, setUpdateNonce] = useState(0);
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const handleCurrentTokenChange = useCallback(
    (token: TokenItem) => {
      onChange?.('');
      onTokenChange?.(token);
      setTokenSelectorVisible(false);
      tokenInputRef.current?.focus();
      setChainServerId(token.chain);
    },
    [onTokenChange, onChange],
  );

  const handleTokenSelectorClose = useCallback(() => {
    setChainServerId(externalChainServerId);
    setTokenSelectorVisible(false);
  }, [externalChainServerId]);

  // when no any queryConds
  const { tokens: allTokens, isLoading: isLoadingAllTokens } = useTokens(
    currentAccount?.address,
    undefined,
    tokenSelectorVisible,
    updateNonce,
    chainServerId,
  );

  const allDisplayTokens = useMemo(() => {
    return allTokens.map(abstractTokenToTokenItem);
  }, [allTokens]);

  const { isLoading: isSearchLoading, list: searchedTokenByQuery } =
    useSearchToken({
      address: currentAccount?.address,
      keyword,
      chainServerId,
    });

  const availableToken = useMemo(() => {
    const allTokens = chainServerId
      ? allDisplayTokens.filter(token => token.chain === chainServerId)
      : allDisplayTokens;
    return uniqBy(
      keyword ? searchedTokenByQuery.map(abstractTokenToTokenItem) : allTokens,
      token => {
        return `${token.chain}-${token.id}`;
      },
    ).filter(e => !excludeTokens.includes(e.id));
  }, [
    allDisplayTokens,
    searchedTokenByQuery,
    excludeTokens,
    keyword,
    chainServerId,
  ]);

  const { sortedList: displayTokenList, triggerResort } =
    useSortTokenPure(availableToken);

  const isListLoading = keyword ? isSearchLoading : isLoadingAllTokens;

  const handleSearchTokens: TokenSelectorProps['onSearch'] = React.useCallback(
    ctx => {
      setKeyword(ctx.keyword);
      setChainServerId(ctx.chainServerId || undefined);
    },
    [],
  );

  useEffect(() => {
    setChainServerId(externalChainServerId);
  }, [externalChainServerId]);

  return {
    allDisplayTokens,
    isLoadingAllTokens,

    displayTokenList,
    isListLoading,

    searchedTokenByQuery,
    isSearchLoading,

    tokenSelectorVisible,
    setTokenSelectorVisible,

    handleCurrentTokenChange,
    handleTokenSelectorClose,
    handleSearchTokens,

    chainServerId,
  };
}

interface TokenAmountInputProps {
  chainServerId: string;
  token: TokenItem;
  value?: string;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  amountFocus?: boolean;
  inlinePrize?: boolean;
  excludeTokens?: TokenItem['id'][];
  className?: string;
  type?: TokenSelectorProps['type'];
  placeholder?: string;
}

/**
 * @description like TokenAmountInput on Rabby
 */
export function TokenAmountInput({
  token,
  value,
  onChange,
  onTokenChange,
  chainServerId: externalChainServerId,
  amountFocus,
  inlinePrize,
  excludeTokens = [],
  style,
  type = 'default',
  placeholder,
}: React.PropsWithChildren<RNViewProps & TokenAmountInputProps>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // devLog('Render TokenAmountInput');

  const {
    isListLoading,
    displayTokenList,

    tokenSelectorVisible,
    setTokenSelectorVisible,

    handleCurrentTokenChange,
    handleTokenSelectorClose,
    handleSearchTokens,
    chainServerId,
  } = useLoadTokenList({
    externalChainServerId,
    excludeTokens,
    onTokenChange,
  });

  return (
    <>
      <View style={[styles.container, style]}>
        <TouchableView
          style={styles.leftToken}
          onPress={() => {
            setTokenSelectorVisible(true);
          }}>
          <View style={styles.leftInner}>
            <AssetAvatar
              logo={token.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              size={24}
            />
            <Text
              style={[styles.leftTokenSymbol]}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {getTokenSymbol(token)}
            </Text>
            <View>
              <RcArrowDown />
            </View>
          </View>
        </TouchableView>
        <View style={styles.rightInput}>
          <TextInput
            placeholder="0"
            placeholderTextColor={colors['neutral-foot']}
            keyboardType="numeric"
            onChangeText={onChange}
          />
        </View>
      </View>

      <TokenSelectorSheetModal
        visible={tokenSelectorVisible}
        list={displayTokenList}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        type={type}
        placeholder={placeholder}
        chainServerId={chainServerId}
      />
    </>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 4,
      padding: 12,
      backgroundColor: colors['neutral-card2'],

      width: '100%',
      height: 52,
      paddingVertical: 0,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    leftToken: {
      position: 'relative',
      flexShrink: 0,
      paddingVertical: 10,
    },
    leftInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 8,
      minWidth: 132,
      borderRightColor: colors['neutral-line'],
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightStyle: 'solid',
    },
    rightInput: {},
    // tokenTriggerSeprator: {
    //   position: 'absolute',
    //   color: colors['neutral-line'],
    //   width: StyleSheet.hairlineWidth,
    //   height: 32,
    //   top: (52 - 32) / 2,
    //   right: 0,
    // },
    leftTokenSymbol: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: 'bold',
      maxWidth: 110,
      paddingHorizontal: 8,
    },

    rightInputContainer: {
      width: '100%',
      flexShrink: 0,
    },
  };
});
