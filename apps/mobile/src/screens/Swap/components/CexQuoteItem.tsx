import { CEX } from '@/constant/swap';
import { getTokenSymbol } from '@/utils/token';
import { CEXQuote } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSwapSettings } from '../hooks';
import { QuoteLogo } from './QuoteLogo';
import { formatAmount } from '@/utils/number';
import { useThemeColors } from '@/hooks/theme';
import { getQuoteItemStyle } from './QuoteItem';

export const CexQuoteItem = (props: {
  name: string;
  data: CEXQuote | null;
  bestQuoteAmount: string;
  bestQuoteGasUsd: string;
  isBestQuote: boolean;
  isLoading?: boolean;
  inSufficient: boolean;
}) => {
  const {
    name,
    data,
    bestQuoteAmount,
    bestQuoteGasUsd,
    isBestQuote,
    isLoading,
  } = props;

  const colors = useThemeColors();
  const styles = useMemo(() => getQuoteItemStyle(colors), [colors]);

  const { t } = useTranslation();
  const dexInfo = useMemo(() => CEX[name as keyof typeof CEX], [name]);
  const { sortIncludeGasFee } = useSwapSettings();
  const [middleContent, rightContent] = useMemo(() => {
    let center: React.ReactNode = <Text>-</Text>;
    let right: React.ReactNode = '';
    let disable = false;

    if (!data?.receive_token?.amount) {
      right = (
        <Text style={styles.failedTipText}>
          {t('page.swap.this-token-pair-is-not-supported')}
        </Text>
      );
      disable = true;
    }

    if (data?.receive_token?.amount) {
      const receiveToken = data.receive_token;

      const bestQuoteUsdBn = new BigNumber(bestQuoteAmount)
        .times(receiveToken.price || 1)
        .minus(sortIncludeGasFee ? bestQuoteGasUsd : 0);
      const receiveUsdBn = new BigNumber(receiveToken.amount).times(
        receiveToken.price || 1,
      );
      const percent = receiveUsdBn
        .minus(bestQuoteUsdBn)
        .div(bestQuoteUsdBn)
        .times(100);

      const s = formatAmount(receiveToken.amount.toString(10));
      const receiveTokenSymbol = getTokenSymbol(receiveToken);

      center = (
        <Text>
          {s}
          <Text style={{ color: colors['neutral-foot'] }}>
            {' '}
            {receiveTokenSymbol}
          </Text>
        </Text>
      );

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
            : `${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`}
        </Text>
      );
    }

    return [center, right, disable];
  }, [
    data?.receive_token,
    styles.failedTipText,
    styles.rightPercentText,
    t,
    bestQuoteAmount,
    sortIncludeGasFee,
    bestQuoteGasUsd,
    colors,
    isBestQuote,
  ]);

  return (
    <View style={styles.cexContainer}>
      <QuoteLogo isCex logo={dexInfo.logo} isLoading={!!isLoading} />

      <Text
        style={[
          styles.nameText,
          {
            width: 100,
            paddingLeft: 8,
          },
        ]}>
        {dexInfo.name}
      </Text>

      <View style={styles.flex1}>
        <Text numberOfLines={1} style={styles.middleDefaultText}>
          {middleContent}
        </Text>
      </View>
      <View>{rightContent}</View>
    </View>
  );
};
