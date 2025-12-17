import React from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import HealthFactorText from '../HealthFactorText';
import { formatTokenAmount } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import { formatNetworth } from '@/utils/math';

const RepayActionOverView: React.FC<
  PopupDetailProps & {
    amount?: string;
    afterHF?: string;
    afterRepayAmount?: string;
    afterRepayUsdValue?: string;
  }
> = ({
  reserve,
  userSummary,
  amount,
  afterHF,
  afterRepayAmount,
  afterRepayUsdValue,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { healthFactor = '0' } = userSummary;
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>
            {t('page.Lending.popup.remainingDebt')}
          </Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>
              {amount
                ? `${formatTokenAmount(reserve?.variableBorrows || '0')} ${
                    reserve.reserve.symbol
                  } → ${formatTokenAmount(afterRepayAmount || '0')} ${
                    reserve.reserve.symbol
                  }`
                : `${formatTokenAmount(reserve?.variableBorrows || '0')} ${
                    reserve.reserve.symbol
                  }`}
            </Text>
          </View>
        </View>
        <View style={[styles.item, styles.hfDescContainer]}>
          <Text style={styles.hfDesc}>
            {amount
              ? `${formatNetworth(
                  Number(reserve.variableBorrowsUSD || '0'),
                )} → ${formatNetworth(Number(afterRepayUsdValue || '0'))}`
              : `${formatNetworth(Number(reserve.variableBorrowsUSD || '0'))}`}
          </Text>
        </View>
        <View style={[styles.item, styles.hfContainer]}>
          <Text style={styles.title}>{t('page.Lending.hf')}</Text>
          <Text style={styles.hfValue}>
            {afterHF ? (
              <>
                <HealthFactorText healthFactor={healthFactor} />
                <Text style={styles.arrow}>→</Text>
                <HealthFactorText
                  healthFactor={afterHF}
                  limitless={afterHF === '-1'}
                />
              </>
            ) : (
              <HealthFactorText healthFactor={healthFactor} />
            )}
          </Text>
        </View>
        <View style={[styles.item, styles.hfDescContainer]}>
          <Text style={styles.hfDesc}>
            {t('page.Lending.popup.liquidationAt')}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default RepayActionOverView;

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
    marginTop: 20,
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
