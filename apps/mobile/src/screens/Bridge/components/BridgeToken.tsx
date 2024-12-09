import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import RcDangerIcon from '@/assets/icons/swap/info-error.svg';
import { useTranslation } from 'react-i18next';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
// import { MaxButton } from '../../SendToken/components/MaxButton';
import { RcIconMaxButton } from '@/assets/icons/swap';
import { tokenAmountBn } from '@/screens/Swap/utils';
import { useBridgeSupportedChains, useSetSettingVisible } from '../hooks';
// import { ChainInfo } from './ChainInfo';
import { ChainInfo } from './ChainInfo';
// import TokenSelect from '@/ui/component/TokenSelect';
// import BridgeToTokenSelect from './BridgeToTokenSelect';
import BridgeToTokenSelect from './BridgeToTokenSelect';
import BridgeFromTokenSelect from './BridgeFromTokenSelect';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import RcIcHelp from '@/assets2024/icons/bridge/IcHelp.svg';
import TokenSelect from '@/screens/Swap/components/TokenSelect';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const BridgeToken = ({
  type = 'from',
  token,
  chain,
  excludeChains,
  onChangeToken,
  onChangeChain,
  value,
  onInputChange,
  valueLoading,
  fromChainId,
  fromTokenId,
  noQuote,
  inSufficient,
  isMaxRef,
  handleMax,
}: {
  handleMax?: () => void;
  isMaxRef?: React.MutableRefObject<boolean>;
  type?: 'from' | 'to';
  token?: TokenItem;
  chain?: CHAINS_ENUM;
  excludeChains?: CHAINS_ENUM[];
  onChangeToken: (token: TokenItem) => void;
  onChangeChain: (chain: CHAINS_ENUM) => void;
  value?: string | number;
  onInputChange?: (v: string) => void;
  valueLoading?: boolean;
  fromChainId?: string;
  fromTokenId?: string;
  noQuote?: boolean;
  inSufficient?: boolean;
}) => {
  const { t } = useTranslation();

  const supportedChains = useBridgeSupportedChains();
  const { colors2024, styles } = useTheme2024({ getStyle });

  const isFromToken = type === 'from';
  const isToken = type === 'to';

  const name = isFromToken ? t('page.bridge.From') : t('page.bridge.To');
  const chainObj = findChainByEnum(chain);

  const openFeePopup = useSetSettingVisible();
  const inputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    if (isFromToken && inputRef.current && !isMaxRef?.current) {
      inputRef.current.focus();
      isMaxRef && (isMaxRef.current = false);
    }
  }, [value, isFromToken, isMaxRef]);

  const showNoQuote = useMemo(() => isToken && !!noQuote, [noQuote, isToken]);

  const useValue = useMemo(() => {
    if (token && value) {
      return formatUsdValue(
        new BigNumber(value).multipliedBy(token.price || 0).toString(),
      );
    }
    return '$0.00';
  }, [token, value]);

  const inputChange = React.useCallback(
    (text: string) => {
      onInputChange?.(text);
    },
    [onInputChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{name}</Text>
        <ChainInfo
          type={isToken ? 'to' : 'from'}
          hideTestnetTab={true}
          style={styles.chainSelector}
          chainEnum={chain}
          onChange={onChangeChain}
          excludeChains={excludeChains}
          supportChains={supportedChains}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.inputContainer}>
          {valueLoading ? (
            <View style={styles.skeleton} />
          ) : isToken ? (
            <Text
              numberOfLines={1}
              style={StyleSheet.flatten([
                styles.input,
                (showNoQuote || !value) && styles.showNoQuoteText,
              ])}>
              {showNoQuote ? t('page.bridge.no-quote') : value?.toString() || 0}
            </Text>
          ) : (
            <TextInput
              numberOfLines={1}
              keyboardType="numeric"
              inputMode="decimal"
              placeholderTextColor={colors2024['neutral-info']}
              style={styles.input}
              placeholder={'0'}
              value={value?.toString()}
              onChangeText={inputChange}
              ref={inputRef}
            />
          )}
          <View style={styles.tokenSelectBox}>
            {isFromToken && !value && (
              <TouchableOpacity onPress={handleMax}>
                <RcIconMaxButton
                  width={40}
                  height={26}
                  style={styles.maxBtnBox}
                />
              </TouchableOpacity>
            )}
            <View style={styles.vecticalLine} />
            {isToken ? (
              <BridgeToTokenSelect
                fromChainId={fromChainId!}
                fromTokenId={fromTokenId!}
                token={token}
                onTokenChange={onChangeToken}
                chainId={chainObj?.serverId!}
                type={'to'}
                placeholder={t('page.swap.search-by-name-address')}
              />
            ) : (
              <BridgeFromTokenSelect
                // fromChainId={fromChainId!}
                // fromTokenId={fromTokenId!}
                token={token}
                onTokenChange={onChangeToken}
                chainId={chainObj?.serverId!}
                type={'from'}
                placeholder={t('page.swap.search-by-name-address')}
              />
            )}
          </View>
        </View>

        {!valueLoading && (
          <View style={styles.footer}>
            <View style={styles.balanceContainer}>
              {<Text style={styles.value}>{useValue}</Text>}
              {isToken && !!value && (
                <TouchableOpacity
                  onPress={() => openFeePopup(true)}
                  style={styles.infoIcon}>
                  <RcIcHelp />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.balanceContainer}>
              {inSufficient && token ? (
                <View style={styles.inSufficient}>
                  <Text style={styles.inSufficientText}>
                    {t('page.swap.insufficient-balance')}
                    {': '}
                    {formatTokenAmount(tokenAmountBn(token).toString(10))}
                  </Text>
                </View>
              ) : (
                <Text style={styles.balanceText}>
                  {t('page.bridge.Balance')}
                  {token
                    ? formatTokenAmount(tokenAmountBn(token).toString(10)) ||
                      '0'
                    : 0}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    // borderWidth: 0.5,
    // borderColor: '#D0D8E0',
    height: 148,
    // width: '100%',
  },
  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop: 16,
    // marginHorizontal: 20,
  },
  inSufficientText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    fontWeight: '400',
  },
  tokenSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxBtnBox: {
    marginRight: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  chainSelector: {
    height: 32,
    marginLeft: 8,
  },
  vecticalLine: {
    marginRight: 12,
    borderWidth: 0,
    borderLeftWidth: 1,
    width: 0,
    height: 27,
    borderColor: colors2024['neutral-line'],
  },
  headerText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  body: {
    // padding: 16,
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 56,
    alignItems: 'center',
  },
  showNoQuoteText: {
    color: colors2024['neutral-info'],
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    // fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    // height: 36,
    lineHeight: 36,
    paddingLeft: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  skeleton: {
    // marginTop: 16,
    backgroundColor: '#E0E5F0',
    height: 36,
    width: 138,
    borderRadius: 100,
  },
  footer: {
    // marginTop: 14,
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 13,
    color: '#6A7587',
  },
  infoIcon: {
    marginLeft: 4,
  },
  balanceText: {
    fontSize: 13,
    color: '#6A7587',
  },
}));

export default BridgeToken;
