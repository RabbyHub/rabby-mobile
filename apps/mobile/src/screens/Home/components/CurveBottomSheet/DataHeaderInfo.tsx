import { RcIconInfoCC } from '@/assets/icons/common';
import { Tip } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import React, { useMemo, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import AnimateableText from 'react-native-animateable-text';
import { useDerivedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { CurvePoint } from '../../hooks/useCurve';
import IconOfflineCC from '@/assets/icons/home/offline-cc.svg';
import { createGetStyles } from '@/utils/styles';
import { TabKey } from './TimeTab';

export const DataHeaderInfo = ({
  activeKey,
  currentDate,
  currentPercentChange,
  currentIsLoss,
  currentBalance,
  isOffline,
  data,
  supportChainList,
  isLoading,
  isNoAssets,
  showSupportChainList,
}: {
  activeKey: TabKey;
  currentDate: string;
  currentPercentChange: string;
  currentIsLoss: boolean;
  currentBalance: string;
  isOffline: boolean;
  data?: CurvePoint[];
  supportChainList: string[];
  isLoading: boolean;
  isNoAssets: boolean;
  showSupportChainList: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { currentIndex } = LineChart.useChart();

  const title = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.timestamp
      ? data?.[currentIndex.value].dateString
      : currentDate;
  }, [data, currentDate, currentIndex, activeKey]);

  const usdValue = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.value
      ? data?.[currentIndex.value].netWorth
      : currentBalance;
  }, [data, currentBalance, currentIndex.value]);

  const percentChange = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.changePercent !== undefined
      ? `${data?.[currentIndex?.value]?.isLoss ? '-' : '+'}${
          data?.[currentIndex.value].changePercent
        }(${data?.[currentIndex.value].change})`
      : currentPercentChange
      ? `${currentIsLoss ? '-' : '+'}${currentPercentChange}`
      : '';
  }, [data, currentIsLoss, currentPercentChange, currentIndex]);

  const lossStyleProps = useAnimatedStyle(() => {
    if (data?.[currentIndex?.value]) {
      return {
        ...styles.percent,
        color: data?.[currentIndex?.value]?.isLoss
          ? colors['red-default']
          : colors['green-default'],
      };
    }
    return {
      ...styles.percent,
      color: currentIsLoss ? colors['red-default'] : colors['green-default'],
    };
  }, [currentIsLoss, data, currentIndex, colors, styles]);

  const [tipOpen, setTipOpen] = useState(false);

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.dateWrapper}>
          <AnimateableText style={styles.date} text={title} />
          {showSupportChainList && supportChainList?.length > 0 && (
            <View style={styles.chainTextWrapper}>
              <Tip
                isVisible={tipOpen}
                onClose={() => setTipOpen(false)}
                contentStyle={styles.tipContent}
                placement="top"
                content={
                  <View>
                    {supportChainList?.map(e => (
                      <Text key={e} style={styles.tipText}>
                        {e}
                      </Text>
                    ))}
                  </View>
                }>
                <RcIconInfoCC
                  onPress={() => setTipOpen(true)}
                  color={colors['neutral-foot']}
                  width={14}
                  height={14}
                />
              </Tip>

              <Text style={styles.tip} onPress={() => setTipOpen(true)}>
                {supportChainList?.length} chains supported
              </Text>
            </View>
          )}
        </View>
        <View style={styles.balanceChangeWrapper}>
          <AnimateableText style={styles.usdValue} text={usdValue} />
          {!isLoading && (
            <AnimateableText style={lossStyleProps} text={percentChange} />
          )}
        </View>
        {isOffline && (
          <View style={styles.disconnectWrapper}>
            <IconOfflineCC color={colors['neutral-body']} />
            <Text style={styles.disconnectText}>
              The network is disconnected and no data is obtained
            </Text>
          </View>
        )}
        {isNoAssets && (
          <Text style={styles.noAssetsText}>No data returned</Text>
        )}
      </View>
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  wrapper: {
    paddingHorizontal: 22,
    gap: 8,
    marginBottom: 10,
  },
  dateWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  chainTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
    position: 'relative',
    top: Platform.select({ ios: 0, android: -2 }),
  },
  tipContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 13,
    color: colors['neutral-title-2'],
  },
  tip: {
    color: colors['neutral-foot'],
    fontSize: 13,
  },
  date: {
    color: colors['neutral-foot'],
    fontSize: 13,
  },
  balanceChangeWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  usdValue: {
    color: colors['neutral-title-1'],
    fontSize: 32,
    fontWeight: '700',
  },
  percent: {
    fontSize: 16,
    fontWeight: '500',
    position: 'relative',
    top: Platform.select({ ios: 0, android: -2 }),
  },
  green: {
    color: colors['green-default'],
  },
  red: {
    color: colors['red-default'],
  },
  disconnectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disconnectText: {
    fontSize: 13,
    color: colors['neutral-body'],
    textAlign: 'center',
  },
  noAssetsText: {
    fontSize: 15,
    color: colors['neutral-body'],
    textAlign: 'center',
    width: '100%',
    marginTop: 80,
  },
}));
