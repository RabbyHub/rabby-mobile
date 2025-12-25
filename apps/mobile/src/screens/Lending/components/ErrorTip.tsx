import { Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { DisplayPoolReserveInfo } from '../type';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { RESERVE_USAGE_WARNING_THRESHOLD } from '../utils/constant';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';

export function ReserveErrorTip({
  reserve,
  style,
}: RNViewProps & {
  reserve?: DisplayPoolReserveInfo;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const errorMessage = useMemo(() => {
    if (!reserve) {
      return undefined;
    }
    if (
      reserve.reserve.totalLiquidity &&
      reserve.reserve.totalLiquidity !== '0' &&
      reserve.reserve.supplyCap &&
      reserve.reserve.supplyCap !== '0' &&
      BigNumber(reserve.reserve.totalLiquidity).gte(reserve.reserve.supplyCap)
    ) {
      return t('page.Lending.supplyOverview.reachCap');
    }
    // 占比大于98% 显示警告
    if (
      reserve.reserve.totalLiquidity &&
      reserve.reserve.totalLiquidity !== '0' &&
      reserve.reserve.supplyCap &&
      reserve.reserve.supplyCap !== '0' &&
      BigNumber(reserve.reserve.totalLiquidity).gte(
        BigNumber(reserve.reserve.supplyCap).multipliedBy(
          RESERVE_USAGE_WARNING_THRESHOLD,
        ),
      )
    ) {
      const available = BigNumber(reserve.reserve.supplyCapUSD)
        .minus(BigNumber(reserve.reserve.totalLiquidityUSD))
        .toString();
      return t('page.Lending.supplyOverview.almostCap', {
        available: formatUsdValueKMB(available),
      });
    }
    return undefined;
  }, [reserve, t]);

  if (!errorMessage) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tipItem}>
        <RcIconWarningCircleCC
          width={18}
          height={18}
          color={colors2024['red-default']}
          style={{ marginRight: 8 }}
        />
      </View>
      <Text style={styles.tipText}>{errorMessage}</Text>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: colors2024['red-light-1'],
    },

    tipItem: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingTop: 2,
    },
    tipIcon: {
      width: 14,
      justifyContent: 'center',
      height: 20,
    },
    tipText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      color: colors2024['red-default'],
    },
  };
});
