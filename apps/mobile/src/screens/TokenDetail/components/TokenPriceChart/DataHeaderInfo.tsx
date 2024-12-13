import IconOfflineCC from '@/assets/icons/home/offline-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/screens/Home/hooks/useCurve';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import { last } from 'lodash';
import React from 'react';
import { Text, View } from 'react-native';
import AnimateableText from 'react-native-animateable-text';
import { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';

export const DataHeaderInfo = ({
  currentPercentChange,
  currentIsLoss,
  currentBalance,
  isOffline,
  data,
  isLoading,
  isNoAssets,
}: {
  currentPercentChange: string;
  currentIsLoss: boolean;
  currentBalance: string;
  isOffline: boolean;
  data?: CurvePoint[];
  isLoading: boolean;
  isNoAssets: boolean;
}) => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });

  const { currentIndex } = LineChart.useChart();

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
        // display: isLoading ? 'none' : undefined,
        color: data?.[currentIndex?.value]?.isLoss
          ? colors2024['red-default']
          : colors2024['green-default'],
      };
    }
    return {
      ...styles.percent,
      // display: isLoading ? 'none' : undefined,
      color: currentIsLoss
        ? colors2024['red-default']
        : colors2024['green-default'],
    };
  }, [currentIsLoss, data, currentIndex, colors, styles, isLoading]);

  // console.log('isLoading', isLoading, usdValue.value, percentChange.value);

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.balanceChangeWrapper}>
          {!isLoading ? (
            <>
              <AnimateableText style={styles.usdValue} text={usdValue} />
              <AnimateableText style={lossStyleProps} text={percentChange} />
            </>
          ) : (
            <>
              <Skeleton width={181} height={42} style={styles.skeleton} />
              <Skeleton width={71} height={22} style={styles.skeleton} />
            </>
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    paddingHorizontal: 25,
    gap: 8,
    height: 71,
  },

  balanceChangeWrapper: {
    flexDirection: 'column',
    gap: 7,
  },
  usdValue: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  percent: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    position: 'relative',
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
  disconnectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disconnectText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    color: colors2024['neutral-body'],
    textAlign: 'center',
  },
  noAssetsText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    color: colors2024['neutral-body'],
    textAlign: 'center',
    width: '100%',
    marginTop: 80,
  },
  skeleton: {
    borderRadius: 8,
  },
}));
