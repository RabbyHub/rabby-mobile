import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { CurveLoader } from '@/screens/Home/components/CurveBottomSheet/CurveLoader';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/screens/Home/hooks/useCurve';
import { memo } from 'react';
import { Dimensions } from 'react-native';

const ScreenWidth = Dimensions.get('screen').width;

function Chart({
  data,
  isOffline,
  loading,
  isNoAssets,
  pathColor,
}: {
  isOffline: boolean;
  data: CurvePoint[];
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
}) {
  const { colors } = useTheme2024();
  return (
    <LineChart.Provider data={data}>
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
