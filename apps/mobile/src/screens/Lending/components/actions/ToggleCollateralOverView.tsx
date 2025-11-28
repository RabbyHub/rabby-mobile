import React from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import { isHFEmpty } from '../../utils';
import HealthFactorText from '../HealthFactorText';
import { useTranslation } from 'react-i18next';
import TokenIcon from '../TokenIcon';
import { useSelectedMarket } from '../../hooks';
import { formatTokenAmount } from '@/utils/number';

const ToggleCollateralOverView: React.FC<
  PopupDetailProps & {
    afterHF?: string;
  }
> = ({ reserve, afterHF, userSummary }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { healthFactor = '0' } = userSummary;
  const { chainEnum } = useSelectedMarket();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={[styles.item]}>
          <Text style={styles.title}>
            {t('page.Lending.supplyDetail.supplyBalance')}
          </Text>
          <View style={styles.tokenInfos}>
            <TokenIcon
              size={16}
              chain={chainEnum}
              chainSize={8}
              tokenSymbol={reserve.reserve.symbol}
            />
            <Text style={styles.symbol}>
              {`${formatTokenAmount(
                Number(reserve.underlyingBalance || '0'),
              )} ${reserve.reserve.symbol}`}
            </Text>
          </View>
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

export default ToggleCollateralOverView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: '100%',
    marginTop: 12,
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
    paddingTop: 15,
    paddingBottom: 19,
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
  availableValue: {
    textAlign: 'right',
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  apy: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  hfContainer: {
    gap: 6,
    marginTop: 24,
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
    marginTop: 0,
  },
  arrow: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
