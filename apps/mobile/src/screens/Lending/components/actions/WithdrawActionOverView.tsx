import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import { isHFEmpty } from '../../utils';
import HealthFactorText from '../HealthFactorText';
import { formatTokenAmount } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import { formatNetworth } from '@/utils/math';

const WithdrawActionOverView: React.FC<
  PopupDetailProps & {
    amount?: string;
    afterHF?: string;
    afterSupply?: {
      balance: string;
      balanceUSD: string;
    };
  }
> = ({ reserve, userSummary, afterHF, afterSupply, amount }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { healthFactor = '0' } = userSummary;
  const availableText = useMemo(() => {
    return `${formatNetworth(Number(reserve.underlyingBalanceUSD || '0'))}`;
  }, [reserve.underlyingBalanceUSD]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>
            {t('page.Lending.withdrawDetail.remainingSupply')}
          </Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>
              {amount
                ? `${formatTokenAmount(reserve?.underlyingBalance || '0')} ${
                    reserve.reserve.symbol
                  } → ${formatTokenAmount(afterSupply?.balance || '0')} ${
                    reserve.reserve.symbol
                  }`
                : `${formatTokenAmount(reserve?.underlyingBalance || '0')} ${
                    reserve.reserve.symbol
                  }`}
            </Text>
          </View>
        </View>
        <View style={[styles.item, styles.hfDescContainer]}>
          <Text style={styles.hfDesc}>
            {afterSupply
              ? `${availableText} → ${formatNetworth(
                  Number(afterSupply.balanceUSD || '0'),
                )}`
              : availableText}
          </Text>
        </View>

        <View
          style={[
            styles.item,
            styles.hfContainer,
            isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
          ]}>
          <Text style={styles.title}>{t('page.Lending.hf')}</Text>
          <Text style={styles.hfValue}>
            {afterHF ? (
              <>
                <HealthFactorText healthFactor={healthFactor} />
                <Text style={styles.arrow}>→</Text>
                <HealthFactorText healthFactor={afterHF} />
              </>
            ) : (
              <HealthFactorText healthFactor={healthFactor} />
            )}
          </Text>
        </View>
        <View
          style={[
            styles.item,
            styles.hfDescContainer,
            isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
          ]}>
          <Text style={styles.hfDesc}>
            {t('page.Lending.popup.liquidationAt')}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default WithdrawActionOverView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: '100%',
    marginTop: 24,
  },
  header: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  content: {
    marginTop: 12,
    paddingVertical: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 16,
  },
  item: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  availableValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  apyContainer: {
    marginTop: 26,
  },
  availableValue: {
    flex: 1,
    textAlign: 'right',
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  hfContainer: {
    gap: 6,
    marginTop: 26,
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
  hfDesc: {
    color: colors2024['neutral-body'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  hfDescContainer: {
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  arrow: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
