import { CEX } from '@/constant/swap';
import { getTokenSymbol } from '@/utils/token';
import { CEXQuote } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSwapSettings } from '../hooks';
import { QuoteLogo } from './QuoteLogo';
import { formatAmount } from '@/utils/number';
import { useThemeColors } from '@/hooks/theme';

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

  const { t } = useTranslation();
  const dexInfo = useMemo(() => CEX[name as keyof typeof CEX], [name]);
  const { sortIncludeGasFee } = useSwapSettings();
  const [middleContent, rightContent] = useMemo(() => {
    let center: React.ReactNode = <Text>-</Text>;
    let right: React.ReactNode = '';
    let disable = false;

    if (!data?.receive_token?.amount) {
      right = (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: colors['neutral-body'],
          }}>
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
          style={{
            color: !isBestQuote
              ? colors['red-default']
              : colors['green-default'],
            fontSize: 13,
            fontWeight: '500',
          }}>
          {isBestQuote
            ? t('page.swap.best')
            : `${percent.toFixed(2, BigNumber.ROUND_DOWN)}%`}
        </Text>
      );
    }

    return [center, right, disable];
  }, [
    data?.receive_token,
    t,
    bestQuoteAmount,
    sortIncludeGasFee,
    bestQuoteGasUsd,
    isBestQuote,
    colors,
  ]);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderColor: colors['neutral-line'],
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: 14,
      }}>
      <QuoteLogo isCex logo={dexInfo.logo} isLoading={!!isLoading} />

      <Text
        style={{
          width: 100,
          fontSize: 13,
          fontWeight: '500',
          color: colors['neutral-title-1'],
          paddingLeft: 8,
        }}>
        {dexInfo.name}
      </Text>

      <View
        style={{
          flex: 1,
        }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: '500',
            width: 'auto',
            color: colors['neutral-title-1'],
          }}>
          {middleContent}
        </Text>
      </View>
      <View>{rightContent}</View>
    </View>
  );
};
