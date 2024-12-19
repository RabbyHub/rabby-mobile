import React, {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import RcArrowDownCC from './icons/token-selector-trigger-down-cc.svg';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { useTokens } from '@/hooks/chainAndToken/useToken';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
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
import { convertSmallTokenList } from '@/screens/Home/utils/converAssets';
import { ellipsisOverflowedText } from '@/utils/text';

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
    return allTokens.filter(i => !i._isFold).map(abstractTokenToTokenItem);
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

  const foldTokensList = useMemo(() => {
    const list = convertSmallTokenList(allTokens.filter(i => i._isFold)).map(
      abstractTokenToTokenItem,
    );
    return list.filter(e => !excludeTokens.includes(e.id));
  }, [allTokens, excludeTokens]);

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
    foldTokensList,
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
      placeholder,
    },
    ref,
  ) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });

    // devLog('Render TokenAmountInput');

    const {
      isListLoading,
      displayTokenList,
      foldTokensList,

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
        : '≈$0';

      return {
        valueNum: num,
        valueText,
      };
    }, [value, token.price]);

    return (
      <>
        <View style={[styles.container, style]}>
          <SilentTouchableView
            viewStyle={[
              styles.leftInputContainer,
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
              placeholderTextColor={colors2024['neutral-info']}
              inputMode="decimal"
              keyboardType="numeric"
              numberOfLines={1}
            />
            <View style={styles.inlinePrizeContainer}>
              <Text
                style={styles.inlinePrizeText}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {valueText}
              </Text>
            </View>
          </SilentTouchableView>

          <View style={styles.placeholder} />
          <TouchableOpacity
            style={styles.rightToken}
            onPress={() => {
              setTokenSelectorVisible(true);
            }}>
            <View style={styles.rightInner}>
              <View style={styles.rightTokenInfo}>
                <AssetAvatar
                  logo={token.logo_url}
                  logoStyle={{ backgroundColor: colors2024['neutral-foot'] }}
                  size={24}
                />
                <Text
                  style={[styles.rightTokenSymbol]}
                  ellipsizeMode="tail"
                  numberOfLines={1}>
                  {ellipsisOverflowedText(getTokenSymbol(token), 5)}
                </Text>
              </View>
              <View style={styles.rightArrow}>
                <RcArrowDownCC color={colors2024['neutral-foot']} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <TokenSelectorSheetModal
          visible={tokenSelectorVisible}
          list={isTestnet ? testnetTokenList : displayTokenList}
          foldTokensList={foldTokensList}
          onConfirm={handleCurrentTokenChange}
          onCancel={handleTokenSelectorClose}
          onSearch={handleSearchTokens}
          isLoading={isListLoading}
          type={'send'}
          selectToken={token}
          placeholder={placeholder}
          chainServerId={chainServerId}
        />
      </>
    );
  },
);

const PADDING = 12;

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      borderRadius: 30,
      backgroundColor: colors2024['neutral-bg-2'],
      height: 98,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 20,
    },

    placeholder: {
      height: 28,
      width: 1,
      backgroundColor: colors2024['neutral-line'],
      marginHorizontal: 12,
    },

    rightToken: {},
    rightInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 4,
      backgroundColor: colors2024['neutral-line'],
      borderRadius: 12,
    },
    rightTokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rightArrow: {
      marginLeft: 2,
    },
    rightTokenSymbol: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
    },

    leftInputContainer: {
      flex: 1,
      paddingLeft: PADDING,
      paddingBottom: 16,
      // ...makeDebugBorder('red'),
    },
    containerHasInlinePrize: {},
    input: {
      fontSize: 28,
      fontWeight: '700',
      position: 'relative',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      marginLeft: 7,
      flex: 1,
      paddingTop: 0,
      paddingBottom: 0,
    },
    inputHasInlinePrize: {
      // ...makeDebugBorder(),
    },
    inlinePrizeContainer: {
      height: 18,
      // ...makeDebugBorder(),
    },
    // 'text-r-neutral-foot text-12 text-right max-w-full truncate'
    inlinePrizeText: {
      color: colors2024['neutral-info'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
  };
});
