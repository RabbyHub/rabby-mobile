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
  active: boolean;
  userAddress: string;
  slippage: string;
  fee: string;
  isLoading?: boolean;
  quoteProviderInfo: { name: string; logo: string };
  inSufficient: boolean;
  setActiveProvider: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  >;
}

export const DexQuoteItem = (
  props: QuoteItemProps & {
    preExecResult: QuotePreExecResultInfo;
    onErrQuote?: React.Dispatch<React.SetStateAction<string[]>>;
    onlyShowErrorQuote?: boolean;
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
    active,
    // userAddress,
    isBestQuote,
    slippage,
    // fee,
    inSufficient,
    preExecResult,
    quoteProviderInfo,
    setActiveProvider: updateActiveQuoteProvider,
    onlyShowErrorQuote,
    onErrQuote,
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

  const { isSdkDataPass } = useVerifySdk({
    chain,
    dexId: dexId as DEX_ENUM,
    slippage,
    data: {
      ...quote,
      fromToken: payToken.id,
      fromTokenAmount: new BigNumber(payAmount)
        .times(10 ** payToken.decimals)
        .toFixed(0, 1),
      toToken: receiveToken?.id,
    } as typeof quote,
    payToken,
    receiveToken,
  });

  const halfBetterRateString = '';

  const [middleContent, rightContent, disabled, receivedTokenUsd] =
    useMemo(() => {
      let center: React.ReactNode = <Text>-</Text>;
      let right: React.ReactNode = null;
      let disable = false;
      let receivedUsd: React.ReactNode = null;
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

        receivedUsd = formatUsdValue(
          receivedTokeAmountBn.times(receiveToken.price || 0).toString(10),
        );

        diffUsd = formatUsdValue(
          receivedUsdBn.minus(bestQuoteUsdBn).toString(10),
        );

        const s = formatAmount(receivedTokeAmountBn.toString(10));
        center = <Text style={styles.middleDefaultText}>{s}</Text>;

        right = (
          <Text
            style={[
              styles.rightPercentText,
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
        right = null;
        center = (
          <Text style={styles.failedTipText}>
            {t('page.swap.unable-to-fetch-the-price')}
          </Text>
        );
        disable = true;
      }

      if (quote?.toTokenAmount) {
        if (!preExecResult && !inSufficient) {
          center = (
            <Text style={styles.failedTipText}>
              {t('page.swap.fail-to-simulate-transaction')}
            </Text>
          );
          right = null;
          disable = true;
        }
      }

      if (!isSdkDataPass) {
        disable = true;
        center = (
          <Text style={styles.failedTipText}>
            {t('page.swap.security-verification-failed')}
          </Text>
        );
        right = null;
      }
      return [center, right, disable, receivedUsd, diffUsd];
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
      styles.rightPercentText,
      styles.failedTipText,
      isBestQuote,
      colors,
      t,
    ]);

  const quoteWarning = useMemo(() => {
    if (!quote?.toTokenAmount || !preExecResult) {
      return;
    }

    if (isSwapWrapToken(payToken.id, receiveToken.id, chain)) {
      return;
    }
    const receivedTokeAmountBn = new BigNumber(quote?.toTokenAmount || 0).div(
      10 ** (quote?.toTokenDecimals || receiveToken.decimals),
    );

    const diff = receivedTokeAmountBn
      .minus(
        preExecResult?.swapPreExecTx?.balance_change.receive_token_list[0]
          ?.amount || 0,
      )
      .div(receivedTokeAmountBn);

    const diffPercent = diff.times(100);

    return diffPercent.gt(0.01)
      ? ([
          formatAmount(receivedTokeAmountBn.toString(10)) +
            getTokenSymbol(receiveToken),
          `${diffPercent.toPrecision(2)}% (${formatAmount(
            receivedTokeAmountBn
              .minus(
                preExecResult?.swapPreExecTx?.balance_change
                  .receive_token_list[0]?.amount || 0,
              )
              .toString(10),
          )} ${getTokenSymbol(receiveToken)})`,
        ] as [string, string])
      : undefined;
  }, [
    chain,
    payToken.id,
    preExecResult,
    quote?.toTokenAmount,
    quote?.toTokenDecimals,
    receiveToken,
  ]);

  const CheckIcon = useCallback(() => {
    if (disabled || loading || !quote?.tx || !preExecResult?.swapPreExecTx) {
      return null;
    }
    return <WarningOrChecked quoteWarning={quoteWarning} />;
  }, [
    disabled,
    loading,
    quote?.tx,
    preExecResult?.swapPreExecTx,
    quoteWarning,
  ]);

  const [disabledTradeTipsOpen, setDisabledTradeTipsOpen] = useState(false);

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
    if (disabledTrade) {
      return;
    }
    if (inSufficient) {
      return;
    }
    if (active || disabled || disabledTrade) {
      return;
    }

    updateActiveQuoteProvider({
      name: dexId,
      quote,
      gasPrice: preExecResult?.gasPrice,
      shouldApproveToken: !!preExecResult?.shouldApproveToken,
      shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
      error: !preExecResult,
      halfBetterRate: halfBetterRateString,
      quoteWarning,
      actualReceiveAmount:
        preExecResult?.swapPreExecTx.balance_change.receive_token_list[0]
          ?.amount || '',
      gasUsd: preExecResult?.gasUsd,
    });

    openSwapQuote(false);
  }, [
    gasFeeTooHight,
    disabledTrade,
    inSufficient,
    active,
    disabled,
    updateActiveQuoteProvider,
    dexId,
    quote,
    preExecResult,
    quoteWarning,
    openSwapQuote,
  ]);

  useDebounce(
    () => {
      if (active) {
        updateActiveQuoteProvider(e => ({
          ...e,
          name: dexId,
          quote,
          gasPrice: preExecResult?.gasPrice,
          shouldApproveToken: !!preExecResult?.shouldApproveToken,
          shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
          error: !preExecResult,
          halfBetterRate: halfBetterRateString,
          quoteWarning,
          actualReceiveAmount:
            preExecResult?.swapPreExecTx.balance_change.receive_token_list[0]
              ?.amount || '',
          gasUsed: preExecResult?.gasUsd,
        }));
      }
    },
    300,
    [
      quoteWarning,
      halfBetterRateString,
      active,
      dexId,
      updateActiveQuoteProvider,
      quote,
      preExecResult,
    ],
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
            height: 52,
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
          if (disabledTrade && !inSufficient && quote && preExecResult) {
            setDisabledTradeTipsOpen(true);
          }
          handleClick();
        }}>
        <View
          style={{
            flex: 1,
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
                <ImgLock width={14} height={14} />
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
            <Text numberOfLines={1} style={styles.middleDefaultText}>
              {middleContent}
            </Text>
            <CheckIcon />
          </View>
        </View>

        <View
          style={
            disabled
              ? { display: 'none' }
              : {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }
          }>
          <View
            style={[
              { flexDirection: 'row', gap: 4, alignItems: 'center' },
              gasFeeTooHight && {
                backgroundColor: colors['red-light'],
              },
            ]}>
            {!disabled && !inSufficient && (
              <>
                {gasFeeTooHight ? (
                  <RcIconSwapGasRed width={14} height={14} />
                ) : (
                  <RcIconSwapGas width={14} height={14} />
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
            {!disabled && (
              <Text style={styles.gasUsd}>≈{receivedTokenUsd}</Text>
            )}

            {rightContent}
          </View>
        </View>

        <View
          style={[
            styles.disabledContentWrapper,
            {
              display: disabledTradeTipsOpen ? 'flex' : 'none',
            },
          ]}>
          <View style={styles.disabledContentView}>
            <RcIconSwapInfo width={14} height={14} />
            <Text style={styles.disabledContentText}>
              {t('page.swap.this-exchange-is-not-enabled-to-trade-by-you')}
            </Text>
          </View>
          <TouchableOpacityGesture
            onPress={() => {
              openSwapSettings(true);
              setDisabledTradeTipsOpen(false);
            }}>
            <Text style={styles.disabledContentBtnText}>
              {t('page.swap.enable-it')}
            </Text>
          </TouchableOpacityGesture>
        </View>
      </TouchableOpacity>
    </Tip>
  );
};

const getQuoteLessWarning = ([receive, diff]: [string, string]) =>
  i18n.t('page.swap.QuoteLessWarning', { receive, diff });

export function WarningOrChecked({
  quoteWarning,
}: {
  quoteWarning?: [string, string];
}) {
  const { t } = useTranslation();
  return (
    <Tip
      content={
        quoteWarning
          ? getQuoteLessWarning(quoteWarning)
          : t('page.swap.by-transaction-simulation-the-quote-is-valid')
      }>
      {quoteWarning ? (
        <ImgWarning width={14} height={14} />
      ) : (
        <ImgVerified width={14} height={14} />
      )}
    </Tip>
  );
}

export const getQuoteItemStyle = createGetStyles(colors => ({
  dexContainer: {
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    height: 80,
  },
  cexContainer: {
    flexDirection: 'row',
    borderColor: colors['neutral-line'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  rightPercentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  failedTipText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-body'],
  },
  providerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  flexRow: {
    flexDirection: 'row',
  },
  gasUsd: {
    color: colors['neutral-foot'],
    fontSize: 13,
    fontWeight: '400',
  },
  middleContainer: {
    gap: 4,
    flex: 1,
    paddingRight: 4,
  },
  middleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  middleDefaultText: {
    width: 'auto',
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  rightContainer: { gap: 4, justifyContent: 'flex-end' },

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
  flex1: {
    // flex: 1,
    marginLeft: 'auto',
  },
}));
