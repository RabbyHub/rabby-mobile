import { CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import React, { useMemo, useCallback, useState } from 'react';
import { QuoteLogo } from './QuoteLogo';
import BigNumber from 'bignumber.js';
import ImgLock from '@/assets/icons/swap/lock.svg';
import ImgGas from '@/assets/icons/swap/gas.svg';
import ImgWarning from '@/assets/icons/swap/warn.svg';
import ImgVerified from '@/assets/icons/swap/verified.svg';
import ImgWhiteWarning from '@/assets/icons/swap/warning-white.svg';

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
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '@/utils/i18n';
import { Tip } from '@/components';
import useDebounce from 'react-use/lib/useDebounce';
import { useThemeColors } from '@/hooks/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';

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
    userAddress,
    isBestQuote,
    slippage,
    fee,
    inSufficient,
    preExecResult,
    quoteProviderInfo,
    setActiveProvider: updateActiveQuoteProvider,
  } = props;

  const colors = useThemeColors();

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

  const [
    middleContent,
    rightContent,
    disabled,
    receivedTokenUsd,
    diffReceivedTokenUsd,
  ] = useMemo(() => {
    let center: React.ReactNode = <Text>-</Text>;
    let right: React.ReactNode = '';
    let disable = false;
    let receivedUsd = '0';
    let diffUsd = '0';

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

      const percent = receivedUsdBn
        .minus(bestQuoteUsdBn)
        .div(bestQuoteUsdBn)
        .abs()
        .times(100);

      receivedUsd = formatUsdValue(
        receivedTokeAmountBn.times(receiveToken.price || 0).toString(10),
      );

      diffUsd = formatUsdValue(
        receivedUsdBn.minus(bestQuoteUsdBn).toString(10),
      );

      const s = formatAmount(receivedTokeAmountBn.toString(10));
      const receiveTokenSymbol = getTokenSymbol(receiveToken);
      center = (
        <Text>
          {s}{' '}
          <Text style={{ color: colors['neutral-foot'] }}>
            {receiveTokenSymbol}
          </Text>
        </Text>
      );

      right = (
        <Text
          style={{
            color: !isBestQuote
              ? colors['red-default']
              : colors['green-default'],
            fontSize: 13,
            fontWeight: '500',
          }}>
          {isBestQuote
            ? t('page.swap.best')
            : `-${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`}
        </Text>
      );
    }

    if (!quote?.toTokenAmount) {
      right = (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: colors['neutral-body'],
          }}>
          {t('page.swap.unable-to-fetch-the-price')}
        </Text>
      );
      center = <Text>-</Text>;
      disable = true;
    }

    if (quote?.toTokenAmount) {
      if (!preExecResult && !inSufficient) {
        center = <Text>-</Text>;
        right = (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '400',
              color: colors['neutral-body'],
            }}>
            {t('page.swap.fail-to-simulate-transaction')}
          </Text>
        );
        disable = true;
      }
    }

    if (!isSdkDataPass) {
      disable = true;
      center = <Text>-</Text>;
      right = (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: colors['neutral-body'],
          }}>
          {t('page.swap.security-verification-failed')}
        </Text>
      );
    }
    return [center, right, disable, receivedUsd, diffUsd];
  }, [
    inSufficient,
    quote?.toTokenAmount,
    quote?.toTokenDecimals,
    receiveToken,
    preExecResult,
    dexId,
    isSdkDataPass,
    payAmount,
    bestQuoteAmount,
    sortIncludeGasFee,
    bestQuoteGasUsd,
    colors,
    isBestQuote,
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

  const handleClick = useCallback(() => {
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

  return (
    <TouchableOpacity
      activeOpacity={disabledTrade || inSufficient ? 1 : 0.2}
      style={{
        position: 'relative',
        backgroundColor: !(disabledTrade || disabled || inSufficient)
          ? colors['neutral-card-1']
          : 'transparent',
        borderColor: !(disabledTrade || disabled || inSufficient)
          ? 'transparent'
          : colors['neutral-line'],
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 6,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 2,
        height: 66,
      }}
      onPress={() => {
        if (disabledTrade && !inSufficient && quote && preExecResult) {
          setDisabledTradeTipsOpen(true);
        }
        handleClick();
      }}
      // onMouseEnter={() => {
      //   if (disabledTrade && !inSufficient && quote && preExecResult) {
      //     setDisabledTradeTipsOpen(true);
      //   }
      // }}
      // onMouseLeave={() => {
      //   setDisabledTradeTipsOpen(false);
      // }}
      // onClick={handleClick}
      // className={clsx(
      //   active && 'active',
      //   (disabledTrade || disabled) && 'disabled error',
      //   inSufficient && !disabled && 'disabled inSufficient',
      // )}
    >
      <QuoteLogo loaded logo={quoteProviderInfo.logo} isLoading={isLoading} />
      <View style={{ gap: 4, width: 94, paddingLeft: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: colors['neutral-title-1'],
            }}>
            {quoteProviderInfo.name}
          </Text>
          {!!preExecResult?.shouldApproveToken && (
            <Tip content={t('page.swap.need-to-approve-token-before-swap')}>
              <ImgLock width={14} height={14} />
            </Tip>
          )}
        </View>

        <View
          style={{
            display: disabled && !inSufficient ? 'none' : 'flex',
            flexDirection: 'row',
          }}>
          <ImgGas width={14} height={14} />
          <Text
            style={{
              color: colors['neutral-foot'],
              fontSize: 12,
              fontWeight: '400',
            }}>
            {preExecResult?.gasUsd}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4, flex: 1 }}>
        <View>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: colors['neutral-title-1'],
            }}>
            {middleContent} <CheckIcon />
          </Text>
        </View>
        {!disabled && (
          <Text
            style={{
              color: colors['neutral-foot'],
              fontSize: 12,
              fontWeight: '400',
            }}>
            ≈{receivedTokenUsd}
          </Text>
        )}
      </View>

      <View style={{ gap: 4, justifyContent: 'flex-end' }}>
        <Text
          style={{
            textAlign: 'right',
          }}>
          {rightContent}
        </Text>
        {!disabled && !isBestQuote && (
          <Text
            style={{
              textAlign: 'right',
              fontSize: 12,
              color: colors['neutral-foot'],
            }}>
            {diffReceivedTokenUsd}
          </Text>
        )}
      </View>

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 6,
          backgroundColor: colors['neutral-black'],
          justifyContent: 'center',
          display: disabledTradeTipsOpen ? 'flex' : 'none',
        }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            paddingLeft: 12,
            alignItems: 'center',
          }}>
          <ImgWhiteWarning width={12} height={12} />
          <Text
            style={{
              color: colors['neutral-title-2'],
              fontSize: 14,
              fontWeight: '500',
            }}>
            {t('page.swap.this-exchange-is-not-enabled-to-trade-by-you')}
          </Text>
        </View>
        <Pressable
          onPress={e => {
            e.stopPropagation();
            openSwapSettings(true);
            setDisabledTradeTipsOpen(false);
          }}>
          <Text
            style={{
              color: colors['blue-default'],
              fontSize: 14,
              fontWeight: '500',
              textAlign: 'left',
              paddingLeft: 12 + 12 + 4,
            }}>
            {t('page.swap.enable-it')}
          </Text>
        </Pressable>
      </View>
    </TouchableOpacity>
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
