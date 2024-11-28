import ImgVerified from '@/assets/icons/swap/verified.svg';
import ImgWarning from '@/assets/icons/swap/warn.svg';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';

import { RcIconInfoCC } from '@/assets/icons/common';
import { RcIconSwitchQuoteCC } from '@/assets/icons/swap';
import { Tip } from '@/components';
import { CHAINS_ENUM } from '@/constant/chains';
import { DEX_WITH_WRAP } from '@/constant/swap';
import { useTheme2024 } from '@/hooks/theme';
import i18n from '@/utils/i18n';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuoteProvider } from '../hooks';
import { isSwapWrapToken } from '../utils';
import { DexQuoteItem } from './QuoteItem';
import RcIconNoFind from '@/assets2024/icons/address/noFind.svg';

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
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const {
    receiveRawAmount: receiveAmount,
    payAmount,
    payToken,
    receiveToken,
    activeProvider,
    bestQuoteDex,
    chain,
    openQuotesList,
  } = props;

  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (payToken && receiveToken) {
      setReverse(false);
    }
  }, [receiveToken, payToken]);

  const { receiveNum, payUsd, receiveUsd, diff, sign, showLoss, lossUsd } =
    useMemo(() => {
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
          <View style={styles.emptyWrapper}>
            <RcIconNoFind width={159} height={117} />
            <Text style={styles.emptyText}>
              {t('page.swap.No-available-quote')}
            </Text>
          </View>
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
          onPress={openQuotesList}
        />
        {activeProvider.name && receiveToken ? (
          isBestQuote ? (
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.quoteProvider, styles.quoteProviderBest]}
              onPress={openQuotesList}>
              <Text style={styles.quoteProviderBestText}>Best</Text>
              <RcIconSwitchQuoteCC
                color={colors2024['neutral-InvertHighlight']}
                style={styles.switchImage}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.quoteProvider}
              onPress={openQuotesList}>
              <RcIconSwitchQuoteCC
                color={colors2024['neutral-body']}
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
                    color={colors2024['neutral-foot']}
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  receiveWrapper: {
    position: 'relative',
    marginTop: 35,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
    color: colors2024['neutral-title-1'],
    fontSize: 13,
  },
  receiveWrapperBest: {
    borderColor: colors2024['green-default'],
    backgroundColor: colors2024['green-light-4'],
  },
  receiveWrapperEmpty: {
    borderColor: colors2024['neutral-line'],
    padding: 0,
    paddingVertical: 11,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  emptyWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 21,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 'normal',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
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
  diffText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
  },
  warning: {
    marginBottom: 8,
    padding: 8,
    position: 'relative',
    backgroundColor: colors2024['orange-light'],
    borderRadius: 4,
  },
  warningText: {
    fontWeight: '400',
    fontSize: 13,
    color: colors2024['orange-default'],
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
    paddingTop: 8,
  },
  rateText: {
    color: colors2024['neutral-body'],
    fontSize: 14,
    fontWeight: '400',
  },
  rateValue: {
    maxWidth: 182,
    fontSize: 14,
    fontWeight: '400',
    color: colors2024['neutral-body'],
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

    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  quoteProviderBest: {
    backgroundColor: colors2024['green-default'],
    borderColor: colors2024['green-default'],
  },
  quoteProviderBestText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-InvertHighlight'],
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
    color: colors2024['neutral-title-2'],
  },
  gap4: {
    gap: 4,
  },

  gap6: { gap: 6 },

  red: {
    color: colors2024['red-default'],
  },
  green: {
    color: colors2024['green-default'],
  },
  afterWrapper: {
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 12,
  },
  afterLabel: {
    fontSize: 13,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  afterValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  afterValue: {
    fontSize: 14,
    lineHeight: 17,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  impactTooltip: {
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'black',
  },
  impactTooltipText: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: 'white',
  },
  warningTipContainer: {
    marginTop: 11,
    marginHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors2024['red-light-1'],
    padding: 8,
  },
  warningTip: {
    color: colors2024['red-default'],
    fontWeight: '400',
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 14.3,
  },
}));
