import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { formatPrice, formatUsdValue } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import * as d3Shape from 'd3-shape';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { CurveLoader } from './CurveLoader';
import { DataHeaderInfo } from './DataHeaderInfo';
import { REAL_TIME_TAB_LIST, TabKey, TIME_TAB_LIST, TimeTab } from './TimeTab';
import {
  CurvePoint,
  formatTokenDateCurve,
  use24hCurveData,
  useDateCurveData,
} from './useCurve';

const DATE_FORMATTER = 'MMM DD, YYYY';

const isRealTimeKey = (key: string) => REAL_TIME_TAB_LIST.includes(key);

const winInfo = Dimensions.get('window');

interface Props {
  token: AbstractPortfolioToken;
}
export function TokenPriceChart(props: Props) {
  const { token } = props;
  const { colors, styles } = useThemeStyles(getStyles);

  const [activeKey, setActiveKey] = useState<TabKey>(TIME_TAB_LIST[0].key);
  const [ready, setReady] = useState(false);
  const { data: realTimeData, loading: curveLoading } = use24hCurveData({
    tokenId: token._tokenId,
    serverId: token.chain,
  });
  const { data: dateCurveData, loading: timeMachineLoading } = useDateCurveData(
    {
      tokenId: token._tokenId,
      serverId: token.chain,
      ready: ready,
    },
  );

  const timeMachMapping = useMemo(() => {
    let result = {} as Record<
      Exclude<TabKey, '24h' | '1W'>,
      ReturnType<typeof formatTokenDateCurve>
    >;
    TIME_TAB_LIST.forEach(e => {
      if (!isRealTimeKey(e.key) && dateCurveData) {
        result[e.key] = formatTokenDateCurve(e.value, dateCurveData as any);
      }
    });
    return result;
  }, [dateCurveData]);

  const data = useMemo(() => {
    if (isRealTimeKey(activeKey)) {
      return realTimeData;
    }
    return timeMachMapping[activeKey as keyof typeof timeMachMapping];
  }, [activeKey, realTimeData, timeMachMapping]);

  const { isUp, percent } = useMemo(() => {
    if (data?.list?.length) {
      const pre = data?.list?.[0]?.value;
      const now = data?.list?.[data?.list?.length - 1]?.value;
      const isLoss = now < pre;
      const currentPercent =
        pre === 0
          ? now === 0
            ? '0%'
            : '100%'
          : Math.abs(((now - pre) / pre) * 100).toFixed(2) + '%';
      return {
        isUp: !isLoss,
        percent: currentPercent,
      };
    }
    return {
      isUp: true,
      percent: '',
    };
  }, [data]);

  const pathColor = isUp ? colors['green-default'] : colors['red-default'];

  const currentInfo = useMemo(() => {
    return {
      date: dayjs().format(DATE_FORMATTER),
      balance: '$' + formatPrice(token.price || 0),
      isLoss: !!data?.isLoss,
      percent: percent,
    };
  }, [data?.isLoss, percent, token.price]);

  const curve24hXOffset = useSharedValue(0);
  const timeMachineXOffset = useSharedValue(0);

  return (
    <View>
      {TIME_TAB_LIST.map(e => (
        <View key={e.key} style={activeKey !== e.key && styles.hidden}>
          <Chart
            isOffline={false}
            data={
              (isRealTimeKey(e.key)
                ? realTimeData?.list
                : timeMachMapping?.[e.key]?.list) || []
            }
            activeKey={e.key}
            currentInfo={currentInfo}
            loading={isRealTimeKey(e.key) ? curveLoading : timeMachineLoading}
            isNoAssets={false}
            pathColor={pathColor}
            xOffset={e.key === '24h' ? curve24hXOffset : timeMachineXOffset}
          />
        </View>
      ))}
      <View style={styles.timeTabWrapper}>
        <TimeTab
          activeKey={activeKey}
          onPress={v => {
            setActiveKey(v);
            if (v !== '24h') {
              setReady(true);
            }
          }}
        />
      </View>
    </View>
  );
}

function Chart({
  data,
  activeKey,
  currentInfo,
  isOffline,
  loading,
  pathColor,
  xOffset,
}: {
  isOffline: boolean;
  data: CurvePoint[];
  activeKey: TabKey;
  currentInfo: {
    date: string;
    percent: string;
    isLoss: boolean;
    balance: string;
  };
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
  xOffset: SharedValue<number>;
}) {
  const { colors, styles } = useThemeStyles(getStyles);

  return (
    <LineChart.Provider data={data}>
      <DataHeaderInfo
        key={activeKey}
        currentPercentChange={currentInfo.percent}
        currentIsLoss={currentInfo.isLoss}
        currentBalance={currentInfo.balance}
        isOffline={false}
        data={data}
        isLoading={loading}
        isNoAssets={false}
      />

      {loading ? (
        <CurveLoader />
      ) : data?.length ? (
        <>
          <LineChart
            height={114}
            width={winInfo.width - 32}
            shape={d3Shape.curveLinear}
            style={styles.chart}>
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
            <Mask xOffset={xOffset} />
          </LineChart>
        </>
      ) : (
        <View style={{ height: 115 }}></View>
      )}
    </LineChart.Provider>
  );
}

const Mask = ({ xOffset }: { xOffset: SharedValue<number> }) => {
  const colors = useThemeColors();
  const styles = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors['neutral-bg-1'],
    transform: [
      {
        translateX: xOffset.value,
      },
    ],
  }));

  useEffect(() => {
    const windowWidth = Dimensions.get('window').width;
    xOffset.value = withTiming(windowWidth, { duration: 500 });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View style={styles} />;
};

const getStyles = createGetStyles(colors => ({
  chart: {
    position: 'relative',
    marginHorizontal: 16,
  },
  timeTabWrapper: {
    paddingTop: 7,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  xTitle: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  xText: {
    fontSize: 13,
    color: colors['neutral-foot'],
  },
  hidden: {
    display: 'none',
  },
}));
