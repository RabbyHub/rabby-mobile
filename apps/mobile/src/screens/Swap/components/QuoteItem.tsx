/* eslint-disable react-native/no-inline-styles */
import ImgLock from '@/assets/icons/swap/lock.svg';
import { CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo } from 'react';
import { QuoteLogo } from './QuoteLogo';

import {
  QuotePreExecResultInfo,
  QuoteProvider,
  isSwapWrapToken,
  useSwapSettings,
} from '../hooks';

import { AssetAvatar } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useSwapBottomModalTips } from '../hooks/tip';
import { Text } from '@/components/Typography';

const GAS_USE_AMOUNT_LIMIT = 2_000_000;

export interface QuoteItemProps {
  quote: QuoteResult | null;
  name: string;
  loading?: boolean;
  payToken: TokenItem;
  receiveToken: TokenItem;
  payAmount: string;
  chain: CHAINS_ENUM;
  isBestQuote: boolean;
  bestQuoteGasUsd: string;
  bestQuoteAmount: string;
  userAddress: string;
  slippage: string;
  fee: string;
  isLoading?: boolean;
  quoteProviderInfo: { name: string; logo: string };
  inSufficient: boolean;
  setActiveProvider?: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  >;
  currentProvider?: QuoteProvider;
  sortIncludeGasFee: boolean;
  onPress?: () => void;
  onCloseQuoteList?: () => void;
}

export const DexQuoteItem = (
  props: QuoteItemProps & {
    preExecResult: QuotePreExecResultInfo;
    onErrQuote?: React.Dispatch<React.SetStateAction<string[]>>;
    onlyShowErrorQuote?: boolean;
    onlyShow?: boolean;
  },
) => {
  const {
    isLoading,
    quote,
    name: dexId,
    bestQuoteAmount,
    bestQuoteGasUsd,
    payToken,
    receiveToken,
    payAmount,
    chain,
    // userAddress,
    isBestQuote,
    // fee,
    inSufficient,
    preExecResult,
    quoteProviderInfo,
    setActiveProvider,
    currentProvider,
    onlyShowErrorQuote,
    onErrQuote,
    onlyShow,
    onPress,
    onCloseQuoteList,
  } = props;

  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { sortIncludeGasFee } = useSwapSettings();

  const isSdkDataPass = !!preExecResult?.isSdkPass;

  const halfBetterRateString = '';

  const { receiveAmount, diffPercent, disabled, receivedTokenUsd, errorText } =
    useMemo(() => {
      let disable = false;
      let error: string | null = null;
      let percentText = '';

      const actualReceiveAmount = new BigNumber(quote?.toTokenAmount || 0)
        .div(10 ** (quote?.toTokenDecimals || receiveToken.decimals))
        .toString();
      const receiveAmountValue =
        actualReceiveAmount || (dexId === 'WrapToken' ? payAmount : '0');
      const bestQuoteAmountBn = new BigNumber(bestQuoteAmount);
      const receivedTokenAmountBn = new BigNumber(receiveAmountValue);

      const receivedUsdBn = receivedTokenAmountBn
        .times(receiveToken.price)
        .minus(sortIncludeGasFee ? preExecResult?.gasUsdValue || 0 : 0);

      const bestQuoteUsdBn = bestQuoteAmountBn
        .times(receiveToken.price)
        .minus(sortIncludeGasFee ? bestQuoteGasUsd : 0);

      if (!isBestQuote) {
        const baseBn = receiveToken.price ? bestQuoteUsdBn : bestQuoteAmountBn;
        const currentBn = receiveToken.price
          ? receivedUsdBn
          : receivedTokenAmountBn;
        const percent = baseBn.isZero()
          ? new BigNumber(0)
          : currentBn.minus(baseBn).div(baseBn).abs().times(100);
        percentText = `-${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`;
      }

      const usdValue = formatUsdValue(
        receivedTokenAmountBn.times(receiveToken.price || 0).toString(10),
      );

      if (!quote?.toTokenAmount) {
        disable = true;
        error = t('page.swap.unable-to-fetch-the-price');
      }

      if (!isSdkDataPass && !!preExecResult) {
        disable = true;
        error = t('page.swap.security-verification-failed');
      }

      return {
        receiveAmount: receiveAmountValue,
        diffPercent: percentText,
        disabled: disable,
        receivedTokenUsd: usdValue,
        errorText: error,
      };
    }, [
      quote?.toTokenAmount,
      quote?.toTokenDecimals,
      receiveToken.decimals,
      receiveToken.price,
      preExecResult,
      dexId,
      isSdkDataPass,
      payAmount,
      bestQuoteAmount,
      sortIncludeGasFee,
      bestQuoteGasUsd,
      isBestQuote,
      t,
    ]);

  const gasFeeTooHigh = useMemo(() => {
    return (
      new BigNumber(preExecResult?.gasUsed || 0).gte(GAS_USE_AMOUNT_LIMIT) &&
      chain === CHAINS_ENUM.ETH
    );
  }, [preExecResult, chain]);

  const showTips = useSwapBottomModalTips();

  const handleTips = useCallback(
    (
      key:
        | 'inSufficient'
        | 'gasFeeTooHigh'
        | 'approve'
        | 'wrapToken'
        | 'verified',
    ) => {
      let tips = '';

      switch (key) {
        case 'inSufficient':
          tips = t('page.swap.insufficient-balance');
          break;
        case 'gasFeeTooHigh':
          tips = t('page.swap.gas-fee-too-high');
          break;
        case 'approve':
          tips = t('page.swap.need-to-approve-token-before-swap');
          break;
        case 'wrapToken':
          tips = t('page.swap.no-fees-for-wrap');
          break;
        case 'verified':
          tips = t('page.swap.by-transaction-simulation-the-quote-is-valid');
          break;
        default:
          break;
      }

      if (tips) {
        showTips(tips);
      }
    },
    [t, showTips],
  );

  const handleClick = useCallback(() => {
    if (gasFeeTooHigh) {
      handleTips('gasFeeTooHigh');
      return;
    }

    if (inSufficient) {
      return;
    }
    if (disabled) {
      return;
    }

    setActiveProvider?.({
      manualClick: true,
      name: dexId,
      quote,
      gasPrice: preExecResult?.gasPrice,
      shouldApproveToken: !!preExecResult?.shouldApproveToken,
      shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
      error: !preExecResult,
      halfBetterRate: halfBetterRateString,
      quoteWarning: undefined,
      actualReceiveAmount:
        new BigNumber(quote?.toTokenAmount || 0)
          .div(10 ** (quote?.toTokenDecimals || receiveToken.decimals))
          .toString() || '',
      gasUsd: preExecResult?.gasUsd,
      preExecResult: preExecResult,
    });

    onCloseQuoteList?.();
  }, [
    gasFeeTooHigh,
    inSufficient,
    disabled,
    setActiveProvider,
    dexId,
    quote,
    preExecResult,
    receiveToken.decimals,
    onCloseQuoteList,
    handleTips,
  ]);

  const isWrapToken = useMemo(
    () => isSwapWrapToken(payToken.id, receiveToken.id, chain),
    [payToken?.id, receiveToken?.id, chain],
  );

  const isErrorQuote = useMemo(
    () =>
      !isSdkDataPass ||
      !quote?.toTokenAmount ||
      !!(quote?.toTokenAmount && !preExecResult && !inSufficient),
    [isSdkDataPass, quote, preExecResult, inSufficient],
  );

  useEffect(() => {
    if (isErrorQuote && onlyShowErrorQuote) {
      onErrQuote?.(e => {
        return e.includes(dexId) ? e : [...e, dexId];
      });
    }
    if (!onlyShowErrorQuote && !isErrorQuote) {
      onErrQuote?.(e => (e.includes(dexId) ? e.filter(e => e !== dexId) : e));
    }
  }, [dexId, isErrorQuote, onErrQuote, onlyShowErrorQuote]);

  if (!isErrorQuote && onlyShowErrorQuote) {
    return null;
  }

  if (!props.onlyShowErrorQuote && isErrorQuote) {
    return null;
  }

  const showQuoteDetails = !disabled;
  const isActive =
    !onlyShow &&
    !onlyShowErrorQuote &&
    !!currentProvider &&
    currentProvider.name === dexId;

  return (
    <TouchableOpacity
      activeOpacity={inSufficient || gasFeeTooHigh ? 1 : 0.2}
      style={[
        styles.dexContainer,
        onlyShow ? styles.onlyShow : styles.normal,
        isActive && styles.active,
        inSufficient && styles.insufficient,
        isErrorQuote && styles.errorQuote,
      ]}
      onPress={() => {
        if (onlyShow) {
          onPress?.();
          return;
        }
        handleClick();
      }}>
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          <QuoteLogo
            loaded
            logo={quoteProviderInfo.logo}
            isLoading={isLoading}
          />
          <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
            {quoteProviderInfo.name}
          </Text>
          {!!preExecResult?.shouldApproveToken && (
            <TouchableOpacity onPress={() => handleTips('approve')}>
              <ImgLock width={16} height={16} />
            </TouchableOpacity>
          )}
          {!onlyShow && isBestQuote && (
            <View style={styles.bestInlineTag}>
              <Text style={styles.bestInlineTagText}>
                {t('page.swap.best')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rightSection}>
          {showQuoteDetails && (
            <AssetAvatar size={20} logo={receiveToken.logo_url} />
          )}
          {errorText ? (
            <Text style={styles.failedTipText}>{errorText}</Text>
          ) : (
            <Text
              style={styles.middleDefaultText}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formatTokenAmount(receiveAmount)}
            </Text>
          )}
        </View>
      </View>

      <View style={!showQuoteDetails ? { display: 'none' } : styles.bottomRow}>
        <View
          style={[
            styles.feeSection,
            gasFeeTooHigh && {
              backgroundColor: colors2024['red-light'],
            },
          ]}>
          {!inSufficient && preExecResult?.gasUsd ? (
            <Text
              style={[
                styles.gasUsd,
                gasFeeTooHigh && { color: colors2024['red-default'] },
              ]}>
              Gas: {preExecResult.gasUsd}
            </Text>
          ) : null}
        </View>

        <View style={styles.estimatedValueSection}>
          <Text style={styles.receivedTokenUsd} numberOfLines={1}>
            {isWrapToken
              ? `≈ ${receivedTokenUsd}`
              : t('page.swap.usd-after-fees', {
                  usd: receivedTokenUsd,
                })}
          </Text>
        </View>
      </View>

      {!disabled && !onlyShow && !isBestQuote && !!diffPercent ? (
        <View style={styles.diffBadge}>
          <Text style={styles.diffBadgeText}>{diffPercent}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  dexContainer: {
    position: 'relative',
    flexDirection: 'column',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
    overflow: 'hidden',
  },
  onlyShow: {
    backgroundColor: 'transparent',
    height: 'auto',
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  normal: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  active: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  insufficient: {
    opacity: 0.5,
  },
  errorQuote: {
    minHeight: 52,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    overflow: 'hidden',
    marginRight: 20,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flexShrink: 0,
    maxWidth: '55%',
  },
  nameText: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  bestInlineTag: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 4,
    paddingHorizontal: 4,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bestInlineTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-InvertHighlight'],
  },
  failedTipText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
    lineHeight: 18,
  },
  middleDefaultText: {
    width: 'auto',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  feeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  gasUsd: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 18,
  },
  estimatedValueSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  receivedTokenUsd: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'right',
  },
  diffBadge: {
    position: 'absolute',
    top: -1,
    right: 0,
    borderRadius: 0,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: colors2024['red-light-1'],
  },
  diffBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['red-default'],
  },
}));
