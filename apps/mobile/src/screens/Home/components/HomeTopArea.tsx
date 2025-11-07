import useCachedValue from '@/hooks/common/useCachedValue';
import { useTheme2024 } from '@/hooks/theme';
import { formChartData } from '@/hooks/useCurve';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, View } from 'react-native';
import { HomeTopChart } from './HomeTopChart';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { useSafeSizes } from '@/hooks/useAppLayout';

export const HomeTopArea = ({
  onUpdateIsDecrease,
  curveData,
  isLoadingCurve,
  isDisConnect,
  onRefresh,
}: {
  onUpdateIsDecrease?: (status: boolean) => void;
  curveData?: ReturnType<typeof formChartData>;
  isLoadingCurve: boolean;
  isDisConnect: boolean;
  onRefresh: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const isDecrease = useCachedValue(curveData, 'isLoss');
  const [fold, setFold] = useState(true);
  const { safeOffHeader } = useSafeSizes();

  const pathColor = useMemo(
    () =>
      !curveData?.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, curveData?.isLoss],
  );

  useEffect(() => {
    if (isDecrease !== undefined) {
      onUpdateIsDecrease?.(isDecrease);
    }
  }, [isDecrease, onUpdateIsDecrease]);

  return (
    <View style={[styles.container]}>
      <View style={styles.relativeWrapper}>
        <ImageBackground
          source={
            !isDecrease
              ? require('@/assets2024/singleHome/up.png')
              : require('@/assets2024/singleHome/loss.png')
          }
          resizeMode="cover"
          style={[
            styles.bg,
            {
              top: 0 - safeOffHeader,
              height: safeOffHeader + 110,
            },
          ]}
        />
      </View>

      <GlobalWarning
        hasError={isDisConnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={onRefresh}
      />

      <HomeTopChart
        fold={fold}
        setFold={setFold}
        loading={isLoadingCurve}
        data={
          curveData || {
            list: [],
            rawNetWorth: 0,
            rawChange: 0,
            netWorth: '',
            change: '',
            changePercent: '',
            isLoss: false,
            isEmptyAssets: false,
          }
        }
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
