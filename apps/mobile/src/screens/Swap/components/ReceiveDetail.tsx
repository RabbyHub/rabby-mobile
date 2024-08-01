import ImgVerified from '@/assets/icons/swap/verified.svg';
import ImgWarning from '@/assets/icons/swap/warn.svg';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { RcIconInfoCC } from '@/assets/icons/common';
import {
  RcIconSwapHistoryEmpty,
  RcIconSwitchQuoteCC,
} from '@/assets/icons/swap';
import { Tip } from '@/components';
import { CHAINS_ENUM } from '@/constant/chains';
import { DEX_WITH_WRAP } from '@/constant/swap';
import { useThemeColors } from '@/hooks/theme';
import i18n from '@/utils/i18n';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { Skeleton, SkeletonProps } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuoteProvider } from '../hooks';
import { isSwapWrapToken } from '../utils';
import { DexQuoteItem } from './QuoteItem';

const getQuoteLessWarning = ([receive, diff]: [string, string]) =>
  i18n.t('page.swap.QuoteLessWarning', { receive, diff });

export const WarningOrChecked = ({
  quoteWarning,
}: {
  quoteWarning?: [string, string];
}) => {
  const { t } = useTranslation();
  return (
    <Tip
      content={
        quoteWarning
          ? getQuoteLessWarning(quoteWarning)
          : t('page.swap.by-transaction-simulation-the-quote-is-valid')
      }>
      {quoteWarning ? (
        <ImgWarning width={16} height={16} />
      ) : (
        <ImgVerified width={16} height={16} />
      )}
    </Tip>
  );
};

interface ReceiveDetailsProps {
  payAmount: string;
  receiveRawAmount: string | number;
  payToken: TokenItem;
  receiveToken: TokenItem;
  receiveTokenDecimals?: number;
  quoteWarning?: [string, string];
  loading?: boolean;
  activeProvider?: QuoteProvider;
  isWrapToken?: boolean;
  bestQuoteDex: string;
  chain: CHAINS_ENUM;
  openQuotesList: () => void;
}
export const ReceiveDetails = (props: ReceiveDetailsProps) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const {
    receiveRawAmount: receiveAmount,
    payAmount,
    payToken,
    receiveToken,
    quoteWarning,
    loading = false,
    activeProvider,
    isWrapToken,
    bestQuoteDex,
    chain,
    openQuotesList,
  } = props;

  const [reverse, setReverse] = useState(false);

  const reverseRate = useCallback(() => {
    setReverse(e => !e);
  }, []);

  useEffect(() => {
    if (payToken && receiveToken) {
      setReverse(false);
    }
  }, [receiveToken, payToken]);

  const {
    receiveNum,
    payUsd,
    receiveUsd,
    rate,
    diff,
    sign,
    showLoss,
    lossUsd,
  } = useMemo(() => {
    const pay = new BigNumber(payAmount).times(payToken.price || 0);
    const receiveAll = new BigNumber(receiveAmount);
    const receive = receiveAll.times(receiveToken.price || 0);
    const cut = receive.minus(pay).div(pay).times(100);
    const rateBn = new BigNumber(reverse ? payAmount : receiveAll).div(
      reverse ? receiveAll : payAmount,
    );
    const lossUsd = formatUsdValue(receive.minus(pay).abs().toString());

    return {
      receiveNum: formatAmount(receiveAll.toString(10)),
      payUsd: formatUsdValue(pay.toString(10)),
      receiveUsd: formatUsdValue(receive.toString(10)),
      rate: rateBn.lt(0.0001)
        ? new BigNumber(rateBn.toPrecision(1, 0)).toString(10)
        : formatAmount(rateBn.toString(10)),
      sign: cut.eq(0) ? '' : cut.lt(0) ? '-' : '+',
      diff: cut.abs().toFixed(2),
      showLoss: cut.lte(-5),
      lossUsd,
    };
  }, [payAmount, payToken.price, receiveAmount, receiveToken.price, reverse]);

  const isBestQuote = useMemo(
    () => !!bestQuoteDex && activeProvider?.name === bestQuoteDex,
    [bestQuoteDex, activeProvider?.name],
  );
  const payTokenSymbol = useMemo(() => getTokenSymbol(payToken), [payToken]);
  const receiveTokenSymbol = useMemo(
    () => getTokenSymbol(receiveToken),
    [receiveToken],
  );

  const isWrapTokens = useMemo(
    () => isSwapWrapToken(payToken.id, receiveToken.id, chain),
    [payToken, receiveToken, chain],
  );

  if (!activeProvider) {
    return (
      <View style={[styles.receiveWrapper, styles.receiveWrapperEmpty]}>
        <TouchableOpacity onPress={openQuotesList}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <RcIconSwapHistoryEmpty width={18} height={18} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: 'normal',
                color: colors['neutral-foot'],
              }}>
              {t('page.swap.No-available-quote')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quoteProvider} onPress={openQuotesList}>
          <RcIconSwitchQuoteCC
            color={colors['blue-default']}
            style={styles.switchImage}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.receiveWrapper,
          isBestQuote && styles.receiveWrapperBest,
        ]}>
        <DexQuoteItem
          onlyShow
          quote={activeProvider.quote}
          name={activeProvider.name}
          payToken={payToken}
          receiveToken={receiveToken}
          payAmount={payAmount}
          chain={chain}
          isBestQuote={false}
          bestQuoteGasUsd={'0'}
          bestQuoteAmount={'0'}
          userAddress={''}
          slippage={''}
          fee={''}
          quoteProviderInfo={
            isWrapTokens
              ? {
                  name: t('page.swap.wrap-contract'),
                  logo: receiveToken?.logo_url,
                }
              : DEX_WITH_WRAP[activeProvider.name]
          }
          inSufficient={false}
          sortIncludeGasFee={true}
          preExecResult={activeProvider.preExecResult}
        />
        {activeProvider.name && receiveToken ? (
          isBestQuote ? (
            <TouchableOpacity
              style={[styles.quoteProvider, styles.quoteProviderBest]}
              onPress={openQuotesList}>
              <Text style={styles.quoteProviderBestText}>Best</Text>
              <RcIconSwitchQuoteCC
                color={colors['green-default']}
                style={styles.switchImage}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.quoteProvider}
              onPress={openQuotesList}>
              <RcIconSwitchQuoteCC
                color={colors['blue-default']}
                style={styles.switchImage}
              />
            </TouchableOpacity>
          )
        ) : null}
      </View>
      {showLoss && (
        <View>
          <View style={styles.afterWrapper}>
            <View style={styles.flexRow}>
              <Text style={styles.afterLabel}>
                {t('page.swap.price-impact')}
              </Text>
              <View style={styles.afterValueContainer}>
                <Text style={[styles.afterValue, styles.red]}>
                  {sign}
                  {diff}%
                </Text>
                <Tip
                  content={
                    <View style={styles.impactTooltip}>
                      <Text style={styles.impactTooltipText}>
                        {t('page.swap.est-payment')} {payAmount}
                        {payTokenSymbol} ≈ {payUsd}
                      </Text>
                      <Text style={styles.impactTooltipText}>
                        {t('page.swap.est-receiving')} {receiveNum}
                        {receiveTokenSymbol} ≈ {receiveUsd}
                      </Text>
                      <Text style={styles.impactTooltipText}>
                        {t('page.swap.est-difference')} -{lossUsd}
                      </Text>
                    </View>
                  }>
                  <RcIconInfoCC
                    color={colors['neutral-foot']}
                    width={14}
                    height={14}
                  />
                </Tip>
              </View>
            </View>
          </View>
          <View style={styles.warningTipContainer}>
            <Text style={styles.warningTip}>
              {t('page.swap.loss-tips', {
                usd: lossUsd,
              })}
            </Text>
          </View>
        </View>
      )}
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  receiveWrapper: {
    position: 'relative',
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors['blue-default'],
    borderRadius: 4,
    // padding: 12,
    color: colors['neutral-title-1'],
    fontSize: 13,
  },
  receiveWrapperBest: {
    borderColor: colors['green-default'],
  },
  receiveWrapperEmpty: {
    borderColor: colors['neutral-line'],
    padding: 0,
    paddingVertical: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  column: {
    paddingBottom: 12,
    gap: 10,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  tokenImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  lockImage: {
    width: 14,
    height: 14,
  },
  gasImage: {
    width: 14,
    height: 14,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    marginRight: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    maxWidth: 170,
    overflow: 'hidden',
    marginLeft: 8,
    marginRight: 4,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-foot'],
  },
  warning: {
    marginBottom: 8,
    padding: 8,
    position: 'relative',
    backgroundColor: colors['orange-light'],
    borderRadius: 4,
  },
  warningText: {
    fontWeight: '400',
    fontSize: 13,
    color: colors['orange-default'],
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-line'],
    paddingTop: 8,
  },
  rateText: {
    color: colors['neutral-body'],
    fontSize: 14,
    fontWeight: '400',
  },
  rateValue: {
    maxWidth: 182,
    fontSize: 14,
    fontWeight: '400',
    color: colors['neutral-body'],
  },
  quoteProvider: {
    position: 'absolute',
    top: -11,
    left: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,

    paddingHorizontal: 6,
    paddingVertical: 2,

    backgroundColor: colors['blue-light-1'],
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors['blue-default'],
  },
  quoteProviderBest: {
    backgroundColor: colors['green-light'],
    borderColor: colors['green-default'],
  },
  quoteProviderBestText: {
    fontSize: 13,
    lineHeight: 16,
    color: colors['green-default'],
  },
  switchImage: {
    width: 12,
    height: 12,
  },
  tooltipContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 10,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors['neutral-title-2'],
  },
  gap4: {
    gap: 4,
  },

  gap6: { gap: 6 },

  red: {
    color: colors['red-default'],
  },
  green: {
    color: colors['green-default'],
  },
  afterWrapper: {
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 12,
  },
  afterLabel: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
  afterValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  impactTooltip: {
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  impactTooltipText: {
    fontSize: 12,
    lineHeight: 14,
    color: colors['neutral-title-2'],
  },
  warningTipContainer: {
    marginTop: 8,
    marginHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors['red-light'],
    padding: 10,
  },
  warningTip: {
    color: colors['red-default'],
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 17,
  },
}));
