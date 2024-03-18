import { AppBottomSheetModal } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import React, { forwardRef, useDeferredValue, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
    loading,
    supportChainList,
    isNoAssets,
  } = useTimeMachineData();

  const timeMachMapping = useMemo(() => {
    let result: Record<string, ReturnType<typeof formatTimeMachineCurve>> = {};
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

  const isLoading =
    balanceLoading || (activeKey === '24h' ? curveLoading : loading);

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

  const hoverDataOrigin = useMemo(() => {
    return {
      hoverDate: dayjs().format(DATE_FORMATTER),
      hoverBalance: formatUsdValue(balance || 0),
      hoverIsLoss: !!data?.isLoss,
      hoverPercent: isOffline || !hadAssets ? '0%' : percent,
    };
  }, [balance, data?.isLoss, hadAssets, isOffline, percent]);

  const hoverData = useDeferredValue(hoverDataOrigin);

  return (
    <BottomSheetView>
      <View style={styles.timeTabWrapper}>
        <TimeTab activeKey={activeKey} onPress={setActiveKey} />
      </View>

      <LineChart.Provider data={data?.list || []}>
        <DataHeaderInfo
          key={activeKey}
          activeKey={activeKey}
          currentDate={hoverData.hoverDate}
          currentPercentChange={hoverData.hoverPercent}
          currentIsLoss={hoverData.hoverIsLoss}
          currentBalance={hoverData.hoverBalance}
          isOffline={isOffline}
          data={(data?.list || []) as any}
          supportChainList={supportChainList}
          isLoading={isLoading}
          isNoAssets={isNoAssets}
          showSupportChainList={activeKey !== '24h'}
        />

        {isOffline || isNoAssets ? null : !isLoading ? (
          <>
            <LineChart height={114} shape={d3Shape.curveLinear}>
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

            <View style={styles.xTitle}>
              <Text style={styles.xText}>
                {data?.list
                  ? dayjs
                      .unix(data?.list?.[0]?.timestamp)
                      .format('MMM DD YYYY, HH:mm')
                  : ''}
              </Text>
              <Text style={styles.xText}>
                {data?.list
                  ? dayjs
                      .unix(data?.list?.[data?.list.length - 1]?.timestamp)
                      .format('MMM DD YYYY, HH:mm')
                  : ''}
              </Text>
            </View>
          </>
        ) : (
          <CurveLoader />
        )}
      </LineChart.Provider>
    </BottomSheetView>
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
}));
