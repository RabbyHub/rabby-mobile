import IconOfflineCC from '@/assets/icons/home/offline-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/screens/Home/hooks/useCurve';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import { last } from 'lodash';
import React from 'react';
import { Text, View } from 'react-native';
import AnimateableText from 'react-native-animateable-text';
import {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { LoadingLinear } from './LoadingLinear';

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
    return isLoading
      ? '$0'
      : data?.[currentIndex?.value]?.value
      ? data?.[currentIndex.value].netWorth
      : currentBalance;
  }, [
    isLoading,
    data,
    currentBalance,
    currentIndex.value,
    currentPercentChange,
  ]);

  const usdValueAnimatedProps = useAnimatedProps(() => {
    return {
      text: usdValue.value,
    };
  });

  const percentChange = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.changePercent !== undefined
      ? `${data?.[currentIndex?.value]?.isLoss ? '-' : '+'}${
          data?.[currentIndex.value].changePercent
        }(${data?.[currentIndex.value].change})`
      : currentPercentChange
      ? `${currentIsLoss ? '-' : '+'}${currentPercentChange}`
      : '';
  }, [data, currentIsLoss, currentPercentChange, currentIndex]);

  const percentChangeAnimatedProps = useAnimatedProps(() => {
    return {
      text: percentChange.value,
    };
  });

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

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.balanceChangeWrapper}>
          {!isLoading ? (
            <>
              <View
                // eslint-disable-next-line react-native/no-inline-styles
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AnimateableText
                  style={styles.usdValue}
                  animatedProps={usdValueAnimatedProps}
                />
                <AnimateableText
                  style={lossStyleProps}
                  animatedProps={percentChangeAnimatedProps}
                />
              </View>
              {/* <AnimateableText
                style={lossStyleProps}
                animatedProps={percentChangeAnimatedProps}
              /> */}
            </>
          ) : (
            <>
              <Skeleton
                width={181}
                height={42}
                style={styles.skeleton}
                LinearGradientComponent={LoadingLinear}
              />
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    paddingHorizontal: 25,
    gap: 8,
    height: 50,
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
  pinBadge: {
    // paddingHorizontal: 6,
    // paddingVertical: 4,
    // gap: 4,
    borderRadius: 6,
    backgroundColor: colors2024['brand-light-1'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: 33,
    height: 20,
    flexWrap: 'nowrap',
  },
  pinText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
