import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import React from 'react';
import { View } from 'react-native';
import AnimateableText from 'react-native-animateable-text';
import {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { LoadingLinear } from './LoadingLinear';
import { CurvePoint } from '@/hooks/useCurve';
import { TabKey } from './TimeTab';

export const DataHeaderInfo = ({
  activeKey,
  currentPercentChange,
  currentIsLoss,
  currentBalance,
  data,
}: {
  activeKey: TabKey;
  currentPercentChange: string;
  currentIsLoss: boolean;
  currentBalance: string;
  data?: CurvePoint[];
}) => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });

  const { currentIndex } = LineChart.useChart();

  const usdValue = useDerivedValue(() => {
    return data?.[currentIndex?.value]
      ? data?.[currentIndex.value].netWorth
      : currentBalance;
  }, [data, currentBalance, currentIndex.value, currentPercentChange]);

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
        color: data?.[currentIndex?.value]?.isLoss
          ? colors2024['red-default']
          : colors2024['green-default'],
      };
    }
    return {
      ...styles.percent,
      color: currentIsLoss
        ? colors2024['red-default']
        : colors2024['green-default'],
    };
  }, [currentIsLoss, data, currentIndex, colors, styles]);

  const dateTime = useDerivedValue(() => {
    return (
      (data?.[currentIndex?.value]
        ? activeKey === '24h'
          ? data?.[currentIndex?.value]?.clockTimeString
          : data?.[currentIndex?.value]?.dateTimeString
        : '') || ''
    );
  }, [data, currentIndex, activeKey]);

  const dateTimeAnimatedProps = useAnimatedProps(() => {
    return {
      text: dateTime.value,
    };
  });

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.balanceChangeWrapper}>
          <View
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
            <AnimateableText
              style={styles.usdValue}
              animatedProps={usdValueAnimatedProps}
            />
            <View style={styles.changeSection}>
              <AnimateableText
                style={lossStyleProps}
                animatedProps={percentChangeAnimatedProps}
              />
              <AnimateableText
                style={styles.changeTime}
                animatedProps={dateTimeAnimatedProps}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  );
};

export const DataHeaderInfoSkeleton = () => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.balanceChangeWrapper}>
          <Skeleton
            width={181}
            height={42}
            style={styles.skeleton}
            LinearGradientComponent={LoadingLinear}
          />
          <Skeleton
            width={100}
            height={20}
            style={[styles.skeleton, { borderRadius: 4 }]}
            LinearGradientComponent={LoadingLinear}
          />
        </View>
      </View>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    paddingHorizontal: 25,
    gap: 8,
    height: 74,
  },

  balanceChangeWrapper: {
    flexDirection: 'column',
    gap: 7,
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
    // justifyContent: 'center',
  },
  usdValue: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
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
