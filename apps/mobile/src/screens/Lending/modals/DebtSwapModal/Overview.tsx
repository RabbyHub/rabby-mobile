import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View, Text } from 'react-native';
import TokenIcon from '../../components/TokenIcon';
import { SwappableToken } from '../../types/swap';
import { formatApy } from '../../utils/format';
import { CHAINS_ENUM } from '@/constant/chains';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import BigNumber from 'bignumber.js';
import HealthFactorText from '../../components/HealthFactorText';

interface DebtSwapModalOverviewProps {
  fromToken: SwappableToken;
  toToken?: SwappableToken;
  chainEnum?: CHAINS_ENUM;
  fromAmount: string;
  toAmount: string;
  fromBalanceBn?: string;
  isQuoteLoading?: boolean;
  currentToAmount: string;
  currentHF?: string;
  afterHF?: string;
  showHF?: boolean;
}

const DebtSwapModalOverview = ({
  fromToken,
  toToken,
  chainEnum,
  fromAmount,
  toAmount,
  fromBalanceBn,
  isQuoteLoading,
  currentToAmount,
  currentHF,
  afterHF,
  showHF,
}: DebtSwapModalOverviewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const fromBorrowApyDisplay = useMemo(() => {
    if (!fromToken?.variableBorrowAPY) {
      return '-';
    }
    return formatApy(Number(fromToken.variableBorrowAPY || '0'));
  }, [fromToken?.variableBorrowAPY]);

  const toBorrowApyDisplay = useMemo(() => {
    if (!toToken?.variableBorrowAPY) {
      return '-';
    }
    return formatApy(Number(toToken.variableBorrowAPY || '0'));
  }, [toToken?.variableBorrowAPY]);

  const estimatedFromBorrowAfter = useMemo(() => {
    if (!fromBalanceBn) {
      return new BigNumber(0);
    }
    const amountBn = new BigNumber(fromAmount || 0);
    const bigNumberFromBalanceBn = new BigNumber(fromBalanceBn);
    const after = bigNumberFromBalanceBn?.minus(amountBn);
    return after?.isNegative() ? new BigNumber(0) : after;
  }, [fromAmount, fromBalanceBn]);

  const estimatedToBorrowAfter = useMemo(() => {
    if (!toToken || isNaN(Number(toAmount))) {
      return new BigNumber(0);
    }
    const currentToAmountBn = new BigNumber(currentToAmount || 0);
    const amountBn = new BigNumber(toAmount || 0);
    const after = currentToAmountBn.plus(amountBn);
    return after.isNegative() ? new BigNumber(0) : after;
  }, [currentToAmount, toAmount, toToken]);

  return (
    <>
      <Text style={[styles.sectionTitle, styles.transactionOverviewTitle]}>
        {t('page.Lending.debtSwap.overview.title')}
      </Text>
      <View style={styles.transactionOverviewCard}>
        <View style={styles.transactionOverviewRow}>
          <Text style={styles.transactionOverviewLabel}>
            {t('page.Lending.debtSwap.overview.borrowAPY')}
          </Text>
          <View style={styles.transactionOverviewValues}>
            <Text style={styles.transactionOverviewValue}>
              {fromBorrowApyDisplay}
            </Text>
            <Text style={styles.transactionOverviewArrow}>→</Text>
            <Text style={styles.transactionOverviewValue}>
              {toBorrowApyDisplay}
            </Text>
          </View>
        </View>
        {showHF && currentHF && (
          <View style={[styles.transactionOverviewRow, styles.hfContainer]}>
            <Text style={styles.title}>{t('page.Lending.hf')}</Text>
            <Text style={styles.hfValue}>
              {afterHF ? (
                <>
                  <HealthFactorText healthFactor={currentHF} />
                  <Text style={styles.arrow}>→</Text>
                  <HealthFactorText healthFactor={afterHF} />
                </>
              ) : (
                <HealthFactorText healthFactor={currentHF} />
              )}
            </Text>
          </View>
        )}
        <View style={styles.transactionOverviewRow}>
          <Text style={styles.transactionOverviewLabel}>
            {t('page.Lending.debtSwap.overview.borrowValueAfter')}
          </Text>
          <View style={styles.borrowBalanceGroup}>
            <View style={styles.borrowBalanceItem}>
              <TokenIcon
                size={16}
                chain={chainEnum}
                chainSize={8}
                tokenSymbol={fromToken.symbol}
              />
              <View
                style={[styles.transactionOverviewValues, styles.afterBalance]}>
                <Text style={styles.transactionOverviewValue}>
                  {formatTokenAmount(estimatedFromBorrowAfter.toString(10))}
                </Text>
                <Text
                  style={[
                    styles.transactionOverviewValue,
                    styles.usdValueText,
                  ]}>
                  {estimatedFromBorrowAfter.eq(0)
                    ? '$0'
                    : formatUsdValue(
                        estimatedFromBorrowAfter
                          .multipliedBy(fromToken.usdPrice || '0')
                          .toString(10),
                      )}
                </Text>
              </View>
            </View>
            {toToken && (
              <View
                style={[
                  styles.borrowBalanceItem,
                  isQuoteLoading && styles.loadingOpacity,
                ]}>
                <TokenIcon
                  size={16}
                  chain={chainEnum}
                  chainSize={8}
                  tokenSymbol={toToken.symbol}
                />
                <View
                  style={[
                    styles.transactionOverviewValues,
                    styles.afterBalance,
                  ]}>
                  <Text style={styles.transactionOverviewValue}>
                    {formatTokenAmount(estimatedToBorrowAfter.toString(10))}
                  </Text>
                  <Text
                    style={[
                      styles.transactionOverviewValue,
                      styles.usdValueText,
                    ]}>
                    {formatUsdValue(
                      estimatedToBorrowAfter
                        .multipliedBy(toToken.usdPrice || '0')
                        .toString(10),
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </>
  );
};

export default DebtSwapModalOverview;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    paddingLeft: 4,
  },
  transactionOverviewTitle: {
    marginTop: 26,
  },
  transactionOverviewCard: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderRadius: 16,
    gap: 28,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  transactionOverviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  transactionOverviewLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  transactionOverviewValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  afterBalance: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  transactionOverviewValue: {
    fontSize: 17,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  usdValueText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  transactionOverviewArrow: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  borrowBalanceGroup: {
    flex: 1,
    gap: 10,
  },
  borrowBalanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 4,
  },
  loadingOpacity: {
    opacity: 0.5,
  },
  hfContainer: {
    gap: 6,
  },
  hidden: {
    display: 'none',
  },
  hfValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  title: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
