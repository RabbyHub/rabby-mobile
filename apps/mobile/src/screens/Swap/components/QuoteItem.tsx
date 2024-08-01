import { CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { QuoteLogo } from './QuoteLogo';
import BigNumber from 'bignumber.js';
import ImgLock from '@/assets/icons/swap/lock.svg';
import ImgWarning from '@/assets/icons/swap/warn.svg';
import ImgVerified from '@/assets/icons/swap/verified.svg';

import {
  useSetQuoteVisible,
  useSwapSettings,
  useSwapSettingsVisible,
  useVerifySdk,
  QuotePreExecResultInfo,
  QuoteProvider,
  isSwapWrapToken,
  useRabbyFeeVisible,
} from '../hooks';

import { useTranslation } from 'react-i18next';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '@/utils/i18n';
import { AssetAvatar, Tip } from '@/components';
import useDebounce from 'react-use/lib/useDebounce';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import {
  RcIconSwapGas,
  RcIconSwapGasRed,
  RcIconSwapInfo,
} from '@/assets/icons/swap';
import { TouchableOpacity as TouchableOpacityGesture } from 'react-native-gesture-handler';
import { RcIconInfoCC } from '@/assets/icons/common';

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
    slippage,
    // fee,
    inSufficient,
    preExecResult,
    quoteProviderInfo,
    setActiveProvider,
    onlyShowErrorQuote,
    onErrQuote,
    onlyShow,
  } = props;

  const colors = useThemeColors();
  const styles = useMemo(() => getQuoteItemStyle(colors), [colors]);

  const { t } = useTranslation();

  const { setVisible: openSwapSettings } = useSwapSettingsVisible();
  const openSwapQuote = useSetQuoteVisible();

  const { sortIncludeGasFee } = useSwapSettings();

  const { swapTradeList: tradeList } = useSwapSettings();
  const disabledTrade = useMemo(
    () =>
      !tradeList?.[dexId] &&
      !isSwapWrapToken(payToken.id, receiveToken.id, chain),
    [tradeList, dexId, payToken.id, receiveToken.id, chain],
  );

  const isSdkDataPass = !!preExecResult?.isSdkPass;

  const halfBetterRateString = '';

  const [receiveOrErrorContent, bestQuotePercent, disabled, receivedTokenUsd] =
    useMemo(() => {
      let receiveOrErrorContent: React.ReactNode = null;
      let bestQuotePercent: React.ReactNode = null;
      let disable = false;
      let receivedTokenUsd: string | null = null;
      let diffUsd: React.ReactNode = null;

      const actualReceiveAmount = inSufficient
        ? new BigNumber(quote?.toTokenAmount || 0)
            .div(10 ** (quote?.toTokenDecimals || receiveToken.decimals))
            .toString()
        : preExecResult?.swapPreExecTx.balance_change.receive_token_list[0]
            ?.amount;
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
          <Text
            style={[
              styles.percentText,
              {
                color: !isBestQuote
                  ? colors['red-default']
                  : colors['green-default'],
              },
            ]}>
            {isBestQuote
              ? t('page.swap.best')
              : `-${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`}
          </Text>
        );
      }

      if (!quote?.toTokenAmount) {
        receiveOrErrorContent = null;
        bestQuotePercent = (
          <Text style={styles.failedTipText}>
            {t('page.swap.unable-to-fetch-the-price')}
          </Text>
        );
        disable = true;
      }

      if (quote?.toTokenAmount) {
        if (!preExecResult && !inSufficient) {
          receiveOrErrorContent = (
            <Text style={styles.failedTipText}>
              {t('page.swap.fail-to-simulate-transaction')}
            </Text>
          );
          bestQuotePercent = null;
          disable = true;
        }
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
      inSufficient,
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
      styles.percentText,
      styles.failedTipText,
      isBestQuote,
      colors,
      t,
    ]);

  const CheckIcon = useCallback(() => {
    if (disabled || loading || !quote?.tx || !preExecResult?.swapPreExecTx) {
      return null;
    }
    return <CheckedIcon />;
  }, [disabled, loading, quote?.tx, preExecResult?.swapPreExecTx]);

  const [inSufficientTapTip, setInSufficientTapTip] = useState(false);

  const gasFeeTooHight = useMemo(() => {
    return (
      new BigNumber(preExecResult?.swapPreExecTx?.gas?.gas_used || 0).gte(
        GAS_USE_AMOUNT_LIMIT,
      ) && chain === CHAINS_ENUM.ETH
    );
  }, [preExecResult, chain]);

  const handleClick = useCallback(() => {
    if (gasFeeTooHight) {
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
        preExecResult?.swapPreExecTx.balance_change.receive_token_list[0]
          ?.amount || '',
      gasUsd: preExecResult?.gasUsd,
      preExecResult: preExecResult,
    });

    openSwapQuote(false);
  }, [
    gasFeeTooHight,
    inSufficient,
    disabled,
    setActiveProvider,
    dexId,
    quote,
    preExecResult,
    openSwapQuote,
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

  const [, setIsShowRabbyFeePopup] = useRabbyFeeVisible();

  const tooltipVisible = useMemo(() => {
    if (onlyShow) {
      return false;
    }
    if (gasFeeTooHight || (inSufficient && !disabled)) {
      return undefined;
    }
    return false;
  }, [onlyShow, gasFeeTooHight, inSufficient, disabled]);

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
    <Tip
      content={
        gasFeeTooHight
          ? t('page.swap.gas-fee-too-high')
          : t('page.swap.insufficient-balance')
      }
      isVisible={inSufficientTapTip}
      onClose={() => setInSufficientTapTip(false)}
      tooltipStyle={{
        transform: [{ translateY: 20 }],
      }}>
      <TouchableOpacity
        activeOpacity={
          disabledTrade || inSufficient || gasFeeTooHight ? 1 : 0.2
        }
        style={[
          styles.dexContainer,
          {
            position: 'relative',
            backgroundColor: !(
              disabledTrade ||
              disabled ||
              inSufficient ||
              gasFeeTooHight
            )
              ? colors['neutral-card-1']
              : 'transparent',
            borderColor: !(
              disabledTrade ||
              disabled ||
              inSufficient ||
              gasFeeTooHight
            )
              ? 'transparent'
              : colors['neutral-line'],
          },
          isErrorQuote && {
            // height: 52,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 14,
          },
          onlyShow && {
            backgroundColor: 'transparent',
            height: 'auto',
            shadowColor: 'transparent',
            shadowOffset: undefined,
            shadowOpacity: 0,
            shadowRadius: 0,
          },
        ]}
        onPress={() => {
          if (gasFeeTooHight) {
            setInSufficientTapTip(true);
            return;
          }
          if (inSufficient && !disabled) {
            setInSufficientTapTip(true);
          }
          if (onlyShow) {
            return;
          }
          handleClick();
        }}>
        <View
          style={{
            // flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          {/* top left */}
          {inSufficient && !disabled && <View />}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              ...(inSufficient && !disabled
                ? {
                    position: 'absolute',
                    top: 40 - 12 - 14,
                    left: 0,
                  }
                : {}),
            }}>
            <QuoteLogo
              loaded
              logo={quoteProviderInfo.logo}
              isLoading={isLoading}
            />
            <Text style={styles.nameText}>{quoteProviderInfo.name}</Text>
            {!!preExecResult?.shouldApproveToken && (
              <Tip content={t('page.swap.need-to-approve-token-before-swap')}>
                <ImgLock width={16} height={16} />
              </Tip>
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
            {!disabled && (
              <AssetAvatar size={20} logo={receiveToken.logo_url} />
            )}
            {receiveOrErrorContent}
            <CheckIcon />
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
              gasFeeTooHight && {
                backgroundColor: colors['red-light'],
              },
            ]}>
            {!disabled && !inSufficient && (
              <>
                {gasFeeTooHight ? (
                  <RcIconSwapGasRed
                    viewBox="0 0 16 16"
                    width={16}
                    height={16}
                  />
                ) : (
                  <RcIconSwapGas viewBox="0 0 16 16" width={16} height={16} />
                )}
                <Text
                  style={[
                    styles.gasUsd,
                    gasFeeTooHight && { color: colors['red-default'] },
                  ]}>
                  {preExecResult?.gasUsd}
                </Text>
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {disabled ? (
              <Text>{bestQuotePercent}</Text>
            ) : (
              <>
                <Text style={styles.receivedTokenUsd}>
                  {isWrapToken
                    ? `≈ ${receivedTokenUsd}`
                    : t('page.swap.usd-after-fees', {
                        usd: receivedTokenUsd,
                      })}
                </Text>
                {isWrapToken ? (
                  <Tip content={t('page.swap.no-fees-for-wrap')}>
                    <RcIconInfoCC
                      width={14}
                      height={14}
                      color={colors['neutral-foot']}
                    />
                  </Tip>
                ) : (
                  <TouchableOpacity
                    hitSlop={10}
                    onPress={() => {
                      setIsShowRabbyFeePopup(true);
                    }}>
                    <RcIconInfoCC
                      width={14}
                      height={14}
                      color={colors['neutral-foot']}
                    />
                  </TouchableOpacity>
                )}
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
    </Tip>
  );
};
export function CheckedIcon() {
  const { t } = useTranslation();
  return (
    <Tip content={t('page.swap.by-transaction-simulation-the-quote-is-valid')}>
      <ImgVerified width={16} height={16} />
    </Tip>
  );
}

export const getQuoteItemStyle = createGetStyles(colors => ({
  dexContainer: {
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 10,
    justifyContent: 'center',
    borderRadius: 6,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 12,
    // minHeight: 93,
  },
  percentText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
  },
  failedTipText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-body'],
    lineHeight: 16,
  },

  nameText: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },

  gasUsd: {
    color: colors['neutral-foot'],
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
  },
  receivedTokenUsd: {
    color: colors['neutral-foot'],
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
  },

  middleDefaultText: {
    width: 'auto',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },

  disabledContentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
    backgroundColor: colors['neutral-black'],
    justifyContent: 'center',
  },

  disabledContentView: {
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 12,
    alignItems: 'center',
  },
  disabledContentText: {
    color: colors['neutral-title-2'],
    fontSize: 14,
    fontWeight: '500',
  },
  disabledContentBtnText: {
    color: colors['blue-default'],
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    paddingLeft: 12 + 12 + 4,
  },
  bestQuotePercentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderTopLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors['red-light'],
  },
  bestQuotePercentContainerIsBest: {
    backgroundColor: colors['green-light'],
  },
}));
