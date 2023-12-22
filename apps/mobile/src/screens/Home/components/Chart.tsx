import { useCallback, useMemo, memo, ReactNode } from 'react';
import { Dimensions, StyleSheet, ViewProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { useThemeColors } from '@/hooks';
import { Colors } from '@/consts';
import { LineChart } from '@/components';

import { ChartData } from '../hooks';

type ChartProp = {
  data: ChartData['list'];
  setIndex?(index: number): void;
  style?: ViewProps['style'];
  cursorColor?: string;
  height?: number;
  showCursor?: boolean;
  width?: number;
  chartStyle?: ViewProps['style'];
  hideShadowGradient?: boolean;
  LineGradient?: ReactNode;
  hidePath?: boolean;
  gradientStrokWidth?: number;
  yRange?: { min: number; max: number };
};

const chartWidth = Dimensions.get('window').width;
const heightWidthRatio = 185 / 335;
const defaultHeight = chartWidth * heightWidthRatio;

export const ChartColor = {
  green: '#35E731',
  red: '#FF4B33',
};

const _Chart = ({
  data,
  setIndex,
  style,
  cursorColor,
  height = defaultHeight,
  showCursor,
  width,
  chartStyle,
  hideShadowGradient,
  LineGradient,
  hidePath,
  gradientStrokWidth = 1,
  yRange,
}: ChartProp) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const selectedIndex = useSharedValue(-1);

  console.log('********CHART*****');

  const onCurrentIndexChange = useCallback(
    (index: number) => {
      selectedIndex.value = index;
      setIndex && setIndex(index);
    },
    [selectedIndex, setIndex],
  );
  const crosshairProps: ViewProps = {
    style: styles.highlightSpot,
  };
  const crosshairOuterProps: ViewProps = {
    style: styles.highlightOuterSpot,
  };

  const isUp = useMemo(() => data?.at(-1)?.value >= data[0]?.value, [data]);

  return (
    <GestureHandlerRootView style={style}>
      <LineChart.Provider
        data={data}
        onCurrentIndexChange={onCurrentIndexChange}
        yRange={yRange}>
        <LineChart
          width={width || chartWidth}
          height={height}
          style={chartStyle}>
          <LineChart.Path
            width={gradientStrokWidth}
            color={
              hidePath
                ? 'transparent'
                : LineGradient
                ? 'url(#lineGradient)'
                : isUp
                ? ChartColor.green
                : ChartColor.red
            }
            LineGradient={LineGradient}>
            {hideShadowGradient ? null : <LineChart.ShadowGradient />}
          </LineChart.Path>
          {showCursor ? (
            <LineChart.CursorLine
              selectedIndex={selectedIndex.value}
              color={cursorColor || colors.pureWhite}
            />
          ) : null}
          {showCursor ? (
            <LineChart.CursorCrosshair
              color={isUp ? ChartColor.green : ChartColor.red}
              crosshairProps={crosshairProps}
              crosshairOuterProps={crosshairOuterProps}
              outerSize={12}
            />
          ) : null}
        </LineChart>
      </LineChart.Provider>
    </GestureHandlerRootView>
  );
};

export const Chart = memo(_Chart);

const getStyle = (colors: Colors) =>
  StyleSheet.create({
    highlightSpot: {
      width: 8,
      height: 8,
    },
    highlightOuterSpot: {
      width: 12,
      height: 12,
      backgroundColor: colors.pureWhite,
    },
  });
