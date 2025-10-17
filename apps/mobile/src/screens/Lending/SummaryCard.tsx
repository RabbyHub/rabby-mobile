import React from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import { formatNetworth, formatNum } from '@/utils/math';
import { formatPercent } from '../TokenDetail/util';
import { estDaily } from './utils/format';
import { getHealthStatusColor } from './utils';

interface IProps {
  netWorth: string;
  supplied: string;
  borrowed: string;
  netApy: number;
  healthFactor: string;
}

const SummaryCard = (props: IProps) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.container}>
        <View style={styles.netWorthContainer}>
          <View style={styles.netWorthHeader}>
            <Text style={styles.netWorthTitle}>Net worth</Text>
            <Text style={styles.netWorthValue}>
              {formatNetworth(Number(props.netWorth || '0'))}
            </Text>
          </View>
          <View style={styles.suppliedAndBorrowedContainer}>
            <Text style={styles.suppliedAndBorrowedTitle}>
              Supplied: {formatNetworth(Number(props.supplied || '0'))} |
              Borrowed: {formatNetworth(Number(props.borrowed || '0'))}
            </Text>
          </View>
        </View>
        <View style={styles.estAndHealthContainer}>
          <View style={styles.estDailyContainer}>
            <Text style={styles.sectionHeader}>Est.Daily</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.estDailyValue}>
                {estDaily(props.netWorth, props.netApy)}
              </Text>
              <Text style={styles.netApy}>
                (+{formatPercent(Number(props.netApy || '0'))})
              </Text>
            </View>
          </View>
          <View style={styles.healthFactorContainer}>
            <View style={styles.healthFactorHeader}>
              <Text style={styles.sectionHeader}>Health factor</Text>
              <WarningFillCC
                width={12}
                height={12}
                color={
                  isLight
                    ? ThemeColors2024.dark['neutral-secondary']
                    : ThemeColors2024.light['neutral-secondary']
                }
              />
            </View>
            <View style={styles.sectionContent}>
              <Text
                style={[
                  styles.healthFactorValue,
                  {
                    color: getHealthStatusColor(
                      isLight,
                      Number(props.healthFactor || '0'),
                    ).color,
                  },
                ]}>
                {formatNum(props.healthFactor)}
              </Text>
              <Text
                style={[
                  styles.healthFactorStatus,
                  {
                    color: getHealthStatusColor(
                      isLight,
                      Number(props.healthFactor || '0'),
                    ).color,
                    backgroundColor: getHealthStatusColor(
                      isLight,
                      Number(props.healthFactor || '0'),
                    ).backgroundColor,
                  },
                ]}>
                Healthy
              </Text>
            </View>
          </View>
        </View>
      </View>
      {/* TODO: ext TIPS */}
      {/* <View style={styles.extraContainer}>
        <Text>ext</Text>
      </View> */}
    </>
  );
};

export default SummaryCard;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    backgroundColor: 'rgba(27, 32, 48, 1)',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
  },
  extraContainer: {
    position: 'relative',
    color: colors2024['red-default'],
  },
  suppliedAndBorrowedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  netWorthContainer: {
    gap: 2,
  },
  netWorthHeader: {
    gap: 2,
  },
  netWorthTitle: {
    color: isLight
      ? ThemeColors2024.dark['neutral-foot']
      : ThemeColors2024.light['neutral-foot'],
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
  },
  netWorthValue: {
    color: ThemeColors.dark['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    fontWeight: '800',
  },
  suppliedAndBorrowedTitle: {
    color: isLight
      ? ThemeColors2024.dark['neutral-secondary']
      : ThemeColors2024.light['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  estAndHealthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  estDailyContainer: {
    flex: 1,
    gap: 2,
  },
  sectionHeader: {
    color: isLight
      ? ThemeColors2024.dark['neutral-foot']
      : ThemeColors2024.light['neutral-foot'],
  },
  healthFactorContainer: {
    flex: 1,
    gap: 2,
  },
  healthFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estDailyValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['green-default'],
  },
  netApy: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['green-default'],
  },
  healthFactorValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['green-default'],
  },
  healthFactorStatus: {
    color: colors2024['green-default'],
    backgroundColor: colors2024['green-light-4'],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
}));
