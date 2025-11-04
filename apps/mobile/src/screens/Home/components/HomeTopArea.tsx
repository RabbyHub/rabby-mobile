import { ALERT_HEIGHT, HEADER_TOP_AREA_HEIGHT } from '@/constant/layout';
import useCachedValue from '@/hooks/common/useCachedValue';
import { useTheme2024 } from '@/hooks/theme';
import { formChartData } from '@/hooks/useCurve';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, View } from 'react-native';
import { HomeTopChart } from './HomeTopChart';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';

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
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const isDecrease = useCachedValue(curveData, 'isLoss');
  const [fold, setFold] = useState(true);

  const topBg = React.useMemo(() => {
    if (isDecrease) {
      if (isLight) {
        return require('@/assets2024/singleHome/home-loss-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-loss-dark-bg-2.png');
      }
    } else {
      if (isLight) {
        return require('@/assets2024/singleHome/home-profit-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-profit-dark-bg-2.png');
      }
    }
  }, [isDecrease, isLight]);

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
    <View
      style={[
        styles.container,
        {
          // height: HEADER_TOP_AREA_HEIGHT + (isDisConnect ? ALERT_HEIGHT : 0),
        },
      ]}>
      {/* TODO: add background image */}
      <ImageBackground
        source={topBg}
        resizeMode="cover"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: fold ? 70 : 150,
        }}
      />

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
}));
