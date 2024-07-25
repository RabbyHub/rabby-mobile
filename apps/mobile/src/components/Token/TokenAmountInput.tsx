import React, {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import RcArrowDownCC from './icons/token-selector-trigger-down-cc.svg';
import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { useTokens } from '@/hooks/chainAndToken/useToken';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { abstractTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import useSearchToken from '@/hooks/chainAndToken/useSearchToken';
import { uniqBy } from 'lodash';
import {
  TokenSelectorProps,
  TokenSelectorSheetModal,
} from './TokenSelectorSheetModal';
import { AssetAvatar } from '../AssetAvatar';
import { useSortTokenPure } from '@/screens/Home/hooks/useSortTokens';
import { formatSpeicalAmount, splitNumberByStep } from '@/utils/number';
import { NumericInput } from '../Form/NumbericInput';
import { useSearchTestnetToken } from '@/hooks/chainAndToken/useSearchTestnetToken';
import { useFindChain } from '@/hooks/useFindChain';

const RcArrowDown = makeThemeIconFromCC(RcArrowDownCC, 'neutral-foot');

const isIOS = Platform.OS === 'ios';

function useLoadTokenList({
  externalChainServerId,
  excludeTokens = [],
  onTokenChange,
  onChange,
  ref,
}: {
  externalChainServerId?: string;
  excludeTokens?: TokenItem['id'][];
  onTokenChange?: TokenAmountInputProps['onTokenChange'];
  onChange?: TokenAmountInputProps['onChange'];
  ref?: React.RefObject<TextInput> | null;
} = {}) {
  const { currentAccount } = useCurrentAccount();
  const [keyword, setKeyword] = useState('');
  const [chainServerId, setChainServerId] = useState(externalChainServerId);

  const internalInputRef = useRef<TextInput>(null);
  const tokenInputRef = ref || internalInputRef;
  const [updateNonce, setUpdateNonce] = useState(0);
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const chainItem =
    useFindChain({
      serverId: chainServerId,
    }) || null;
  const isTestnet = chainItem?.isTestnet;

  const handleCurrentTokenChange = useCallback(
    (token: TokenItem) => {
      console.log('handleCurrentTokenChange', token);
      onChange?.('');
      onTokenChange?.(token);
      setTokenSelectorVisible(false);
      tokenInputRef.current?.focus();
      setChainServerId(token.chain);
    },
    [onTokenChange, onChange, tokenInputRef],
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

  const { loading: isSearchTestnetLoading, testnetTokenList } =
    useSearchTestnetToken({
      address: currentAccount?.address,
      withBalance: keyword ? false : true,
      chainId: chainItem?.id,
      q: keyword,
      enabled: isTestnet,
    });

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

  const { sortedList: displayTokenList } = useSortTokenPure(availableToken);

  const isListLoading = useMemo(() => {
    if (isTestnet) {
      return isSearchTestnetLoading;
    }
    return keyword ? isSearchLoading : isLoadingAllTokens;
  }, [
    keyword,
    isSearchLoading,
    isLoadingAllTokens,
    isSearchTestnetLoading,
    isTestnet,
  ]);

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

    tokenInputRef,
    tokenSelectorVisible,
    setTokenSelectorVisible,

    handleCurrentTokenChange,
    handleTokenSelectorClose,
    handleSearchTokens,

    chainServerId,
    chainItem,

    isSearchTestnetLoading,
    testnetTokenList,
    isTestnet,
  };
}

interface TokenAmountInputProps {
  chainServerId: string;
  token: TokenItem;
  value?: string;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  /**
   * @deprecated allow amountFocus = true to trigger focus,
   * just for compability
   */
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
export const TokenAmountInput = React.forwardRef<
  TextInput,
  React.PropsWithChildren<RNViewProps & TokenAmountInputProps>
>(
  (
    {
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
    },
    ref,
  ) => {
    const colors = useThemeColors();
    const styles = getStyles(colors);

    // devLog('Render TokenAmountInput');

    const {
      isListLoading,
      displayTokenList,

      tokenInputRef,

      tokenSelectorVisible,
      setTokenSelectorVisible,

      handleCurrentTokenChange,
      handleTokenSelectorClose,
      handleSearchTokens,
      chainServerId,
      testnetTokenList,
      isTestnet,
    } = useLoadTokenList({
      externalChainServerId,
      excludeTokens,
      onTokenChange,
      ref: ref as React.RefObject<TextInput>,
    });

    useLayoutEffect(() => {
      if (amountFocus && !tokenSelectorVisible) {
        tokenInputRef.current?.focus();
      }
    }, [amountFocus, tokenSelectorVisible, tokenInputRef]);

    const { valueText } = useMemo(() => {
      const num = Number(value);

      const valueText = num
        ? `≈$${splitNumberByStep(((num || 0) * token.price || 0).toFixed(2))}`
        : '';

      return {
        valueNum: num,
        valueText,
      };
    }, [value, token.price]);

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
          <SilentTouchableView
            viewStyle={[
              styles.rightInputContainer,
              inlinePrize && !!valueText && styles.containerHasInlinePrize,
            ]}
            onPress={evt => {
              evt.stopPropagation();
              tokenInputRef.current?.focus();
            }}>
            <NumericInput
              style={[
                inlinePrize && !!valueText && styles.inputHasInlinePrize,
                styles.input,
              ]}
              value={value}
              onChangeText={(value: string) => {
                onChange?.(formatSpeicalAmount(value));
              }}
              ref={tokenInputRef}
              placeholder="0"
              placeholderTextColor={colors['neutral-foot']}
              inputMode="decimal"
              keyboardType="numeric"
            />
            {inlinePrize && (
              <View style={styles.inlinePrizeContainer}>
                <Text
                  style={styles.inlinePrizeText}
                  ellipsizeMode="tail"
                  numberOfLines={1}>
                  {valueText}
                </Text>
              </View>
            )}
          </SilentTouchableView>
        </View>

        <TokenSelectorSheetModal
          visible={tokenSelectorVisible}
          list={isTestnet ? testnetTokenList : displayTokenList}
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
  },
);

const PADDING = 12;

const getStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 4,
      padding: PADDING,
      paddingRight: 0,
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
    leftTokenSymbol: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: 'bold',
      maxWidth: 110,
      paddingHorizontal: 8,
    },

    rightInputContainer: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      flexShrink: 1,
      width: '100%',
      height: '100%',
      paddingRight: PADDING,
      // ...makeDebugBorder('red')
    },
    containerHasInlinePrize: {
      position: 'relative',
    },
    input: {
      fontSize: 18,
      height: '100%',
    },
    inputHasInlinePrize: {
      position: 'absolute',
      top: -6,
      right: PADDING / 2,
      fontWeight: '500',
      height: '50%',
      // ...makeDebugBorder()
    },
    inlinePrizeContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',

      position: 'absolute',
      bottom: 2,
      right: PADDING / 2,
    },
    // 'text-r-neutral-foot text-12 text-right max-w-full truncate'
    inlinePrizeText: {
      color: colors['neutral-foot'],
      fontSize: 13,
      textAlign: 'right',
      fontWeight: '500',
      maxWidth: '100%',
    },
  };
});
