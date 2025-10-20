import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import {
  formatAmountValueKMB,
  formatPercent,
} from '@/screens/TokenDetail/util';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../../utils';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';

const SupplyActionOverView: React.FC<
  PopupDetailProps & {
    afterHF?: string;
    afterAvailable?: string;
  }
> = ({ reserve, userSummary, afterHF, afterAvailable }) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { availableBorrowsUSD = '0', healthFactor = '0' } = userSummary;

  const apyText = useMemo(() => {
    return formatPercent(Number(reserve?.reserve?.supplyAPY || '0'));
  }, [reserve?.reserve?.supplyAPY]);

  const availableText = useMemo(() => {
    return `$${formatAmountValueKMB(availableBorrowsUSD || '0')}`;
  }, [availableBorrowsUSD]);

  const hfColors = useMemo(() => {
    return getHealthStatusColor(isLight, Number(healthFactor || '0'));
  }, [healthFactor, isLight]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Transaction Overview</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>Available to borrow</Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>
              {availableText}-{formatAmountValueKMB(afterAvailable || '0')}
            </Text>
            <WarningFillCC
              width={12}
              height={12}
              color={colors2024['neutral-info']}
            />
          </View>
        </View>

        <View style={[styles.item, styles.apyContainer]}>
          <Text style={styles.title}>Supply APY</Text>
          <Text style={styles.apy}>{apyText}</Text>
        </View>

        <View style={[styles.item, styles.hfContainer]}>
          <Text style={styles.title}>Health factor</Text>
          <Text
            style={[
              styles.hfValue,
              {
                color: hfColors.color,
              },
            ]}>
            {formatNum(healthFactor)} {formatNum(afterHF)}
          </Text>
        </View>
        <View style={[styles.item, styles.hfDescContainer]}>
          <Text style={styles.hfDesc}>{'Liquidation at < 1.0'}</Text>
        </View>
      </View>
    </View>
  );
};

export default SupplyActionOverView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: '100%',
    marginTop: 24,
  },
  header: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
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
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  availableValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  apyContainer: {
    marginTop: 26,
  },
  availableValue: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  apy: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  hfContainer: {
    gap: 6,
    marginTop: 26,
  },
  hfValue: {
    fontSize: 17,
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
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  hfDescContainer: {
    justifyContent: 'flex-end',
    marginTop: 8,
  },
}));
