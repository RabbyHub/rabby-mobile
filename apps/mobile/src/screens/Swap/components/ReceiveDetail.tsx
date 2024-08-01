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
import { formatAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { DEX, DEX_WITH_WRAP } from '@/constant/swap';
import {
  RcIconSwapGas,
  RcIconSwapReceiveInfo,
  RcIconSwitchQuote,
} from '@/assets/icons/swap';
import { CHAINS_ENUM } from '@/constant/chains';
import { isSwapWrapToken } from '../utils';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
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
      diff: cut.abs().toFixed(2) + '%',
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
      <TouchableOpacity onPress={openQuotesList}>
        <View>
          <RcIconEmptyCC width={16} height={16} />
          <Text>{t('page.swap.No-available-quote')}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.receiveWrapper}>
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
        <TouchableOpacity style={styles.quoteProvider} onPress={openQuotesList}>
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
    // padding: 12,
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
