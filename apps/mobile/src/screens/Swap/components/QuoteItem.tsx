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
  useSetQuoteVisible,
  useSwapSettings,
} from '../hooks';

import { AssetAvatar } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSwapBottomModalTips } from '../hooks/tip';

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
  sortIncludeGasFee: boolean;
  onPress?: () => void;
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
    loading,
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
    onlyShowErrorQuote,
    onErrQuote,
    onlyShow,
    onPress,
  } = props;

  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const openSwapQuote = useSetQuoteVisible();

  const { sortIncludeGasFee } = useSwapSettings();

  const isSdkDataPass = !!preExecResult?.isSdkPass;

  const halfBetterRateString = '';

  const [receiveOrErrorContent, bestQuotePercent, disabled, receivedTokenUsd] =
    useMemo(() => {
      let receiveOrErrorContent: React.ReactNode = null;
      let bestQuotePercent: React.ReactNode = null;
      let disable = false;
      let receivedTokenUsd: string | null = null;
      let diffUsd: React.ReactNode = null;

      const actualReceiveAmount = new BigNumber(quote?.toTokenAmount || 0)
        .div(10 ** (quote?.toTokenDecimals || receiveToken.decimals))
        .toString();

      if (actualReceiveAmount || dexId === 'WrapToken') {
        const receiveAmount =
          actualReceiveAmount || (dexId === 'WrapToken' ? payAmount : 0);
        const bestQuoteAmountBn = new BigNumber(bestQuoteAmount);
        const receivedTokeAmountBn = new BigNumber(receiveAmount);

        const receivedUsdBn = receivedTokeAmountBn
          .times(receiveToken.price)
          .minus(sortIncludeGasFee ? preExecResult?.gasUsdValue || 0 : 0);

        const bestQuoteUsdBn = bestQuoteAmountBn
          .times(receiveToken.price)
          .minus(sortIncludeGasFee ? bestQuoteGasUsd : 0);

        let percent = receivedUsdBn
          .minus(bestQuoteUsdBn)
          .div(bestQuoteUsdBn)
          .abs()
          .times(100);

        if (!receiveToken.price) {
          percent = receivedTokeAmountBn
            .minus(bestQuoteAmountBn)
            .div(bestQuoteAmountBn)
            .abs()
            .times(100);
        }

        receivedTokenUsd = formatUsdValue(
          receivedTokeAmountBn.times(receiveToken.price || 0).toString(10),
        );

        diffUsd = formatUsdValue(
          receivedUsdBn.minus(bestQuoteUsdBn).toString(10),
        );

        const s = formatAmount(receivedTokeAmountBn.toString(10));
        receiveOrErrorContent = (
          <Text style={styles.middleDefaultText}>{s}</Text>
        );

        bestQuotePercent = (
          <View
            style={[
              styles.percent,
              {
                backgroundColor: !isBestQuote
                  ? colors2024['red-light-1']
                  : colors2024['green-light-1'],
              },
            ]}>
            <Text
              style={[
                styles.percentText,
                {
                  color: !isBestQuote
                    ? colors2024['red-default']
                    : colors2024['green-default'],
                },
              ]}>
              {isBestQuote
                ? t('page.swap.best')
                : `-${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`}
            </Text>
          </View>
        );
      }

      if (!quote?.toTokenAmount) {
        bestQuotePercent = null;
        receiveOrErrorContent = (
          <Text style={styles.failedTipText}>
            {t('page.swap.unable-to-fetch-the-price')}
          </Text>
        );
        disable = true;
      }

      if (!isSdkDataPass && !!preExecResult) {
        disable = true;
        receiveOrErrorContent = (
          <Text style={styles.failedTipText}>
            {t('page.swap.security-verification-failed')}
          </Text>
        );
        bestQuotePercent = null;
      }
      return [
        receiveOrErrorContent,
        bestQuotePercent,
        disable,
        receivedTokenUsd,
        diffUsd,
      ];
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
      styles.middleDefaultText,
      styles.percent,
      styles.percentText,
      styles.failedTipText,
      isBestQuote,
      colors2024,
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

    openSwapQuote(false);
  }, [
    gasFeeTooHigh,
    inSufficient,
    disabled,
    setActiveProvider,
    dexId,
    quote,
    preExecResult,
    receiveToken.decimals,
    openSwapQuote,
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

  return (
    <TouchableOpacity
      activeOpacity={inSufficient || gasFeeTooHigh ? 1 : 0.2}
      style={[
        styles.dexContainer,
        {
          position: 'relative',
          backgroundColor: !(disabled || inSufficient || gasFeeTooHigh)
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-1'],
          borderColor: !(disabled || inSufficient || gasFeeTooHigh)
            ? colors2024['neutral-line']
            : colors2024['neutral-line'],
          borderWidth: 1,
        },
        isErrorQuote && {
          // height: 52,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
        },
      ]}
      onPress={() => {
        if (onlyShow) {
          onPress?.();
          return;
        }
        handleClick();
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: disabled ? 0 : 10,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <QuoteLogo
            loaded
            logo={quoteProviderInfo.logo}
            isLoading={isLoading}
          />
          <Text style={styles.nameText}>{quoteProviderInfo.name}</Text>
          {!!preExecResult?.shouldApproveToken && (
            <TouchableOpacity onPress={() => handleTips('approve')}>
              <ImgLock width={16} height={16} />
            </TouchableOpacity>
          )}
        </View>
        {/* top left end */}

        {/* top right */}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            },
          ]}>
          {!disabled && <AssetAvatar size={20} logo={receiveToken.logo_url} />}
          {receiveOrErrorContent}
        </View>
      </View>

      <View
        style={
          disabled
            ? { display: 'none' }
            : {
                // flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }
        }>
        <View
          style={[
            {
              flexDirection: 'row',
              gap: 4,
              alignItems: 'center',
              paddingLeft: 4,
            },
            gasFeeTooHigh && {
              backgroundColor: colors2024['red-light'],
            },
          ]}>
          {!disabled && !inSufficient && (
            <>
              <Text
                style={[
                  styles.gasUsd,
                  gasFeeTooHigh && { color: colors2024['red-default'] },
                ]}>
                Gas: {preExecResult?.gasUsd}
              </Text>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {disabled ? (
            <>{bestQuotePercent}</>
          ) : (
            <>
              <Text style={styles.receivedTokenUsd}>
                {isWrapToken
                  ? `≈ ${receivedTokenUsd}`
                  : t('page.swap.usd-after-fees', {
                      usd: receivedTokenUsd,
                    })}
              </Text>
            </>
          )}
        </View>
      </View>
      {!disabled && !onlyShow ? (
        <View
          style={[
            styles.bestQuotePercentContainer,
            isBestQuote && styles.bestQuotePercentContainerIsBest,
          ]}>
          {bestQuotePercent}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  dexContainer: {
    position: 'relative',
    paddingLeft: 25,
    paddingRight: 17,
    paddingTop: 36,
    paddingBottom: 30,
    justifyContent: 'center',
    borderRadius: 20,
  },
  onlyShow: {
    backgroundColor: 'transparent',
    height: 'auto',
    shadowColor: 'transparent',
    shadowOffset: undefined,
    shadowOpacity: 0,
    shadowRadius: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  percent: {
    marginLeft: 30,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  percentText: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  failedTipText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
    lineHeight: 16,
  },

  nameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },

  gasUsd: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 18,
  },
  receivedTokenUsd: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 16,
  },

  middleDefaultText: {
    width: 'auto',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },

  disabledContentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-black'],
    justifyContent: 'center',
  },

  disabledContentView: {
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 12,
    alignItems: 'center',
  },
  disabledContentBtnText: {
    color: colors2024['blue-default'],
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    paddingLeft: 12 + 12 + 4,
    lineHeight: 17,
  },
  bestQuotePercentContainer: {
    position: 'absolute',
    top: -1,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderTopLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  bestQuotePercentContainerIsBest: {},
}));
