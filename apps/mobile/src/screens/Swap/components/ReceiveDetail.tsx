import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ImgVerified from '@/assets/icons/swap/verified.svg';
import ImgWarning from '@/assets/icons/swap/warn.svg';
import ImgLock from '@/assets/icons/swap/lock.svg';

import React from 'react';
import { QuoteProvider, useSetQuoteVisible } from '../hooks';
import { useTranslation } from 'react-i18next';
import i18n from '@/utils/i18n';
import { AssetAvatar, Tip } from '@/components';
import { Skeleton, SkeletonProps } from '@rneui/themed';
import { formatAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { DEX } from '@/constant/swap';
import {
  RcIconSwapGas,
  RcIconSwapReceiveInfo,
  RcIconSwitchQuote,
} from '@/assets/icons/swap';

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
        <ImgWarning width={14} height={14} />
      ) : (
        <ImgVerified width={14} height={14} />
      )}
    </Tip>
  );
};

const SkeletonChildren = (
  props: PropsWithChildren<SkeletonProps & { loading?: boolean }>,
) => {
  const { loading = true, children, ...other } = props;
  if (loading) {
    return <Skeleton {...other} />;
  }
  return <>{children}</>;
};

interface ReceiveDetailsProps {
  payAmount: string | number;
  receiveRawAmount: string | number;
  payToken: TokenItem;
  receiveToken: TokenItem;
  receiveTokenDecimals?: number;
  quoteWarning?: [string, string];
  loading?: boolean;
  activeProvider: QuoteProvider;
  isWrapToken?: boolean;
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

  const { receiveNum, payUsd, receiveUsd, rate, diff, sign, showLoss } =
    useMemo(() => {
      const pay = new BigNumber(payAmount).times(payToken.price || 0);
      const receiveAll = new BigNumber(receiveAmount);
      const receive = receiveAll.times(receiveToken.price || 0);
      const cut = receive.minus(pay).div(pay).times(100);
      const rateBn = new BigNumber(reverse ? payAmount : receiveAll).div(
        reverse ? receiveAll : payAmount,
      );

      return {
        receiveNum: formatAmount(receiveAll.toString(10)),
        payUsd: formatAmount(pay.toString(10)),
        receiveUsd: formatAmount(receive.toString(10)),
        rate: rateBn.lt(0.0001)
          ? new BigNumber(rateBn.toPrecision(1, 0)).toString(10)
          : formatAmount(rateBn.toString(10)),
        sign: cut.eq(0) ? '' : cut.lt(0) ? '-' : '+',
        diff: cut.abs().toFixed(2) + '%',
        showLoss: cut.lte(-5),
      };
    }, [payAmount, payToken.price, receiveAmount, receiveToken.price, reverse]);

  const openQuote = useSetQuoteVisible();
  const payTokenSymbol = getTokenSymbol(payToken);
  const receiveTokenSymbol = getTokenSymbol(receiveToken);

  return (
    <View style={styles.receiveWrapper}>
      <View style={styles.column}>
        <View style={styles.flexRow}>
          <View style={styles.flexRow}>
            <Image
              style={styles.tokenImage}
              source={
                isWrapToken
                  ? { uri: receiveToken.logo_url }
                  : DEX[activeProvider?.name]?.logo
              }
            />
            <Text style={styles.titleText}>
              {isWrapToken
                ? t('page.swap.wrap-contract')
                : DEX[activeProvider?.name]?.name}
            </Text>
            {!!activeProvider.shouldApproveToken && (
              <Tip content={t('page.swap.need-to-approve-token-before-swap')}>
                {/* <Image source={ImgLock} style={styles.lockImage} /> */}
                <ImgLock style={styles.lockImage} />
              </Tip>
            )}
          </View>

          <View style={styles.flexRow}>
            <AssetAvatar logo={receiveToken.logo_url} size={20} />
            <Text style={styles.amountText}>
              {loading ? '' : `${receiveNum}`}
            </Text>
            <WarningOrChecked quoteWarning={quoteWarning} />
          </View>
        </View>

        <View style={styles.flexRow}>
          <View style={styles.flexRow}>
            {!!activeProvider?.gasUsd && (
              <View style={styles.flexRow}>
                <RcIconSwapGas style={styles.gasImage} />
                <Text style={[styles.diffText, { marginLeft: 4 }]}>
                  {activeProvider?.gasUsd}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.flexRow, styles.gap6]}>
            <Text style={styles.diffText}>
              {loading ? (
                ''
              ) : (
                <>
                  ≈ {receiveUsd}{' '}
                  <Text style={sign === '-' ? styles.red : styles.green}>
                    ({sign}
                    {diff})
                  </Text>
                </>
              )}
            </Text>
            <Tip
              content={
                <View style={styles.tooltipContent}>
                  <Text
                    style={
                      styles.tooltipText
                    }>{`Est Payment ${payAmount} ${payTokenSymbol} ≈ $${payUsd}`}</Text>
                  <Text
                    style={
                      styles.tooltipText
                    }>{`Est Receiving ${receiveNum} ${receiveTokenSymbol} ≈ $${receiveUsd}`}</Text>
                  <Text
                    style={
                      styles.tooltipText
                    }>{`Est Difference ${sign}${diff}%`}</Text>
                </View>
              }>
              <RcIconSwapReceiveInfo width={16} height={16} />
            </Tip>
          </View>
        </View>
      </View>
      {!loading && quoteWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {getQuoteLessWarning(quoteWarning)}
          </Text>
        </View>
      )}
      {!loading && showLoss && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {t(
              'page.swap.selected-offer-differs-greatly-from-current-rate-may-cause-big-losses',
            )}
          </Text>
        </View>
      )}
      <View style={[styles.flexRow, styles.footer]}>
        <Text style={styles.rateText}>{t('page.swap.rate')}</Text>
        <View>
          <SkeletonChildren loading={loading}>
            <TouchableOpacity onPress={reverseRate}>
              <Text style={styles.rateValue}>{`1 ${
                reverse ? receiveTokenSymbol : payTokenSymbol
              } = ${rate} ${
                reverse ? payTokenSymbol : receiveTokenSymbol
              }`}</Text>
            </TouchableOpacity>
          </SkeletonChildren>
        </View>
      </View>
      {activeProvider.name && receiveToken ? (
        <TouchableOpacity
          style={styles.quoteProvider}
          onPress={() => {
            openQuote(true);
          }}>
          <RcIconSwitchQuote style={styles.switchImage} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  receiveWrapper: {
    position: 'relative',
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors['neutral-line'],
    borderRadius: 4,
    padding: 12,
    color: colors['neutral-title-1'],
    fontSize: 13,
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
    top: -12,
    left: 12,
    height: 20,
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: colors['neutral-body'],
    backgroundColor: colors['blue-light-2'],
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
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
}));
