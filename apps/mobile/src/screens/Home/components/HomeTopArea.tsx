import useCachedValue from '@/hooks/common/useCachedValue';
import { useTheme2024 } from '@/hooks/theme';
import {
  useSingleHomeCurveRefresh,
  useSingleHomeIsDecrease,
  useSingleHomeIsLoss,
} from '@/hooks/useCurve';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { HomeTopChart } from './HomeTopChart';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { CenterBg } from './BgComponents';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { CurveDayType } from '@/utils/curveDayType';
import { perfEvents } from '@/core/utils/perf';

export const HomeTopArea = ({
  currentAddress,
  isDisConnect,
  // fold,
  // setFold,
  reachTop,
}: {
  currentAddress: string;
  isDisConnect: boolean;
  // fold: boolean;
  // setFold: (fold: boolean) => void;
  reachTop: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { balance, balanceLoading, evmBalance } = useCurrentBalance(
    currentAddress,
    {
      update: true,
      noNeedBalance: false,
    },
  );
  const { refresh: refreshCurve } = useSingleHomeCurveRefresh(
    currentAddress,
    evmBalance,
    CurveDayType.DAY,
    balance,
  );

  const { isLoss } = useSingleHomeIsLoss();
  const { isDecrease } = useSingleHomeIsDecrease();

  useEffect(() => {
    refreshCurve();

    const { remove } = perfEvents.subscribe(
      'TMP_TRIGGER:SINGLE_HOME_REFRESH',
      async (ignoreLoading?: boolean) => {
        console.debug('[perf] SINGLE_HOME_REFRESH triggered');
        refreshCurve(ignoreLoading);
      },
    );

    return () => {
      remove();
    };
  }, [refreshCurve]);

  const pathColor = useMemo(
    () => (!isLoss ? colors2024['green-default'] : colors2024['red-default']),
    [colors2024, isLoss],
  );

  return (
    <View style={[styles.container]}>
      {reachTop ? null : (
        <CenterBg /* fold={fold}  */ isDecrease={!!isDecrease} />
      )}
      <GlobalWarning
        hasError={isDisConnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => refreshCurve()}
      />

      <HomeTopChart
        // fold={fold}
        // setFold={setFold}
        balanceLoading={balanceLoading}
        evmBalance={evmBalance}
        pathColor={pathColor}
        isNoAssets={false}
        isOffline={false}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    position: 'relative',
    // overflow: 'hidden',
    // height: HEADER_TOP_AREA_HEIGHT,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginBottom: 13,
  },
  relativeWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 78,
    zIndex: -100,
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
    left: 0,
    width: '100%',
    zIndex: -100,
  },
}));
