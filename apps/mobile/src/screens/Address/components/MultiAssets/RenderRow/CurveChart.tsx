import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { CurveLoader } from '@/screens/Home/components/CurveBottomSheet/CurveLoader';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/screens/Home/hooks/useCurve';
import { memo, useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { formChartData } from '@/hooks/useCurve';

const ScreenWidth = Dimensions.get('screen').width;

function Chart({
  data,
  isOffline,
  loading,
  isNoAssets,
  pathColor,
}: {
  isOffline: boolean;
  data: ReturnType<typeof formChartData>;
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
}) {
  const { colors } = useTheme2024();
  return (
    <LineChart.Provider data={data.list}>
      <ChartHeader
        netWorth={data.netWorth}
        change={data.change}
        changePercent={data.changePercent}
        isLoss={data.isLoss}
        data={data.list}
        loading={loading}
      />
      {isOffline || isNoAssets ? null : !loading ? (
        <>
          <LineChart
            height={114}
            width={ScreenWidth - 40}
            shape={d3Shape.curveLinear}
            style={{ position: 'relative' }}>
            <LineChart.Path
              showInactivePath={false}
              color={pathColor}
              width={2}>
              <LineChart.Gradient color={pathColor} />
            </LineChart.Path>
            <LineChart.CursorLine color={colors['neutral-line']} />
            <LineChart.CursorCrosshair
              color={pathColor}
              outerSize={12}
              size={8}
            />
          </LineChart>
        </>
      ) : (
        <CurveLoader />
      )}
    </LineChart.Provider>
  );
}
export const MultiChart = memo(Chart);

interface IHeaderProps {
  netWorth: string;
  change: string;
  changePercent: string;
  isLoss: boolean;
  loading: boolean;
  data: CurvePoint[];
}
export const ChartHeader = ({
  netWorth,
  change,
  changePercent,
  isLoss,
  loading,
  data,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();
  const percentChange = useMemo(() => {
    const isActiveIndexData =
      data?.[currentIndex?.value]?.changePercent !== undefined;
    const formatChangeValue = isActiveIndexData
      ? data?.[currentIndex.value].change
      : change;
    const formatChangePercent = isActiveIndexData
      ? data?.[currentIndex.value].changePercent
      : changePercent;
    const formatLoss = isActiveIndexData
      ? data?.[currentIndex.value].isLoss
      : isLoss;
    return `${formatLoss ? '-' : '+'}${formatChangeValue}(${
      formatLoss ? '-' : '+'
    }${formatChangePercent})`;
  }, [data, currentIndex.value, change, changePercent, isLoss]);

  const dateTime = useMemo(() => {
    return data?.[currentIndex.value]?.clockTimeString || '24h';
  }, [data, currentIndex]);

  const formatIsLoss = useMemo(() => {
    if (data?.[currentIndex?.value]) {
      return data?.[currentIndex?.value]?.isLoss;
    }
    return isLoss;
  }, [isLoss, data, currentIndex]);
  return (
    <View>
      <Text style={styles.netWorth}>{netWorth}</Text>
      <View style={styles.changeSection}>
        <Text
          style={[
            styles.changePercent,
            {
              color: formatIsLoss
                ? colors2024['red-default']
                : colors2024['green-default'],
            },
          ]}>
          {percentChange}
        </Text>
        <Text style={styles.changeTime}>{dateTime}</Text>
      </View>
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  netWorth: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  changeValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
}));
