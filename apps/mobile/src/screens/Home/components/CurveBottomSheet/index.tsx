import { AppBottomSheetModal } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { Dimensions, Text } from 'react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CurvePoint,
  formatTimeMachineCurve,
  use24hCurveData,
  useTimeMachineData,
} from '../../hooks/useCurve';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { LineChart } from 'react-native-wagmi-charts';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { formatUsdValue } from '@/utils/number';
import * as d3Shape from 'd3-shape';
import { CurveLoader } from './CurveLoader';
import { TIME_TAB_LIST, TabKey, TimeTab } from './TimeTab';
import { DataHeaderInfo } from './DataHeaderInfo';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

dayjs.extend(utc);

const DATE_FORMATTER = 'MMM DD, YYYY';

function Inner() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [activeKey, setActiveKey] = useState<TabKey>(TIME_TAB_LIST[0].key);
  const {
    curveData: curve24hData,
    curveLoading,
    isOffline,
    hadAssets,
    balanceLoading,
  } = use24hCurveData();
  const {
    data: historyData,
    loading: timeMachineLoading,
    supportChainList,
    isNoAssets,
  } = useTimeMachineData(activeKey !== '24h');

  const timeMachMapping = useMemo(() => {
    let result = {} as Record<
      Exclude<TabKey, '24h'>,
      ReturnType<typeof formatTimeMachineCurve>
    >;
    TIME_TAB_LIST.forEach(e => {
      if (e.key !== '24h' && historyData?.result?.data) {
        result[e.key] = formatTimeMachineCurve(
          e.value,
          historyData?.result?.data as unknown as any,
        );
      }
    });
    return result;
  }, [historyData?.result?.data]);

  const data = useMemo(() => {
    if (activeKey === '24h') {
      return curve24hData;
    }
    return timeMachMapping[activeKey];
  }, [activeKey, curve24hData, timeMachMapping]);

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

  const { currentAccount } = useCurrentAccount();
  const { balance } = useCurrentBalance(currentAccount?.address);

  const pathColor = isUp ? colors['green-default'] : colors['red-default'];

  const currentInfo = useMemo(() => {
    return {
      date: dayjs().format(DATE_FORMATTER),
      balance: formatUsdValue(balance || 0),
      isLoss: !!data?.isLoss,
      percent: isOffline || !hadAssets ? '0%' : percent,
    };
  }, [balance, data?.isLoss, hadAssets, isOffline, percent]);
  const curve24hXOffset = useSharedValue(0);
  const timeMachineXOffset = useSharedValue(0);

  return (
    <BottomSheetView>
      <View style={styles.timeTabWrapper}>
        <TimeTab activeKey={activeKey} onPress={setActiveKey} />
      </View>
      {TIME_TAB_LIST.map(e => (
        <View key={e.key} style={activeKey !== e.key && styles.hidden}>
          <Chart
            isOffline={isOffline}
            data={
              (e.key === '24h'
                ? curve24hData?.list
                : timeMachMapping?.[e.key]?.list) || []
            }
            activeKey={e.key}
            currentInfo={currentInfo}
            supportChainList={supportChainList}
            loading={
              balanceLoading ||
              (e.key === '24h' ? curveLoading : timeMachineLoading)
            }
            isNoAssets={e.key !== '24h' ? isNoAssets : false}
            pathColor={pathColor}
            showSupportChainList={e.key !== '24h'}
            xOffset={e.key === '24h' ? curve24hXOffset : timeMachineXOffset}
          />
        </View>
      ))}
    </BottomSheetView>
  );
}

function Chart({
  data,
  activeKey,
  currentInfo,
  isOffline,
  supportChainList,
  loading,
  isNoAssets,
  pathColor,
  showSupportChainList,
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
  supportChainList: string[];
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
  showSupportChainList: boolean;
  xOffset: SharedValue<number>;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <LineChart.Provider data={data}>
      <DataHeaderInfo
        key={activeKey}
        activeKey={activeKey}
        currentDate={currentInfo.date}
        currentPercentChange={currentInfo.percent}
        currentIsLoss={currentInfo.isLoss}
        currentBalance={currentInfo.balance}
        isOffline={isOffline}
        data={data}
        supportChainList={supportChainList}
        isLoading={loading}
        isNoAssets={isNoAssets}
        showSupportChainList={showSupportChainList}
      />

      {isOffline || isNoAssets ? null : !loading ? (
        <>
          <LineChart
            height={114}
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
            <Mask xOffset={xOffset} />
          </LineChart>

          <View style={styles.xTitle}>
            <Text style={styles.xText}>
              {data?.[0]
                ? dayjs.unix(data?.[0]?.timestamp).format('MMM DD YYYY, HH:mm')
                : ''}
            </Text>
            <Text style={styles.xText}>
              {data?.length
                ? dayjs
                    .unix(data?.[data.length - 1]?.timestamp)
                    .format('MMM DD YYYY, HH:mm')
                : ''}
            </Text>
          </View>
        </>
      ) : (
        <CurveLoader />
      )}
    </LineChart.Provider>
  );
}

export const CurveBottomSheetModal = forwardRef<
  BottomSheetModal,
  BottomSheetModalMethods
>((props, ref) => {
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => [393 + bottom], [bottom]);

  return (
    <AppBottomSheetModal snapPoints={snapPoints} ref={ref} enableDismissOnClose>
      <Inner />
    </AppBottomSheetModal>
  );
});

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
  timeTabWrapper: {
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 26,
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
