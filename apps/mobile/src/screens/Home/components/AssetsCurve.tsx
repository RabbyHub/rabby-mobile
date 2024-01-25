import { memo, ReactNode } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import AnimateableText from 'react-native-animateable-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import { colord } from 'colord';
import { useEffect, useMemo, useCallback } from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { useHeaderHeight } from '@react-navigation/elements';

import { ImgAssetsBannerSource } from '@/assets/icons/assets';
import { useThemeColors } from '@/hooks';
import { Colors, Layout } from '@/consts';
import { numFormat, formatDate } from '@/utils';
import { invalidTotalBalance } from '@/screens/Profile/hook';

import { useQueryUsdCurve, invalidateAssetCurve } from '../hooks';
import { ChartLine } from '../types';
import { Chart, ChartColor } from './Chart';
import { ChangeLoader, NetWorthLoader } from './Skeleton';

type AssetsCurveProps = {
  refreshing: boolean;
  isTokensLoading?: boolean;
  isPortfoliosLoading?: boolean;
  grossNetWorth?: number;
  userId: string;
};

const heightWidthRatio = 140 / 390;
const chartWidth = Layout.window.width;
const chartHeight = chartWidth * heightWidthRatio;

const _AssetsCurve = ({
  refreshing,
  grossNetWorth,
  isTokensLoading,
  isPortfoliosLoading,
  userId,
}: AssetsCurveProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  console.log('Render AssetsCurve', refreshing);
  const totalValue = useMemo(
    () => numFormat(grossNetWorth, 0, '$'),
    [grossNetWorth],
  );

  const { data, isLoading } = useQueryUsdCurve(userId);
  const sampledDataList = useMemo(() => data?.list, [data]);
  const yRange = useMemo(
    () =>
      data?.list?.length
        ? { min: data?.minValue * 0.98, max: data?.maxValue * 1.02 }
        : undefined,
    [data],
  );

  useEffect(() => {
    if (refreshing) {
      invalidateAssetCurve();
      invalidTotalBalance();
    }
  }, [refreshing]);

  const index = useSharedValue<number>(-1);
  const setIndex = useCallback(
    (i: number) => {
      index.value = i;
    },
    [index],
  );

  const chartStyle = useMemo(() => ({ height: chartWidth }), []);

  return (
    <HeaderGradient style={StyleSheet.flatten([styles.container])}>
      <ChartHeader
        data={data}
        selectedIndex={index}
        totalValue={totalValue}
        isFinishOne={!isTokensLoading || !isPortfoliosLoading}
        isDataLoading={isLoading}
      />
      {sampledDataList && sampledDataList?.length > 0 ? (
        <Chart
          data={sampledDataList}
          height={chartHeight}
          yRange={yRange}
          width={chartWidth}
          chartStyle={styles.chartStyle}
          style={chartStyle}
          showCursor={!isTokensLoading && !isPortfoliosLoading}
          setIndex={setIndex}
        />
      ) : null}
      <View style={styles.listTop} />
    </HeaderGradient>
  );
};

export const AssetsCurve = memo(_AssetsCurve);

export const FixedHeader = memo(() => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { top } = useSafeAreaInsets();

  const style = useMemo(() => [styles.fixedTitle, { height: top + 56 }], [top]);

  return (
    <View style={style}>
      <HeaderGradient>
        <Image style={styles.fixTitleImg} source={ImgAssetsBannerSource} />
      </HeaderGradient>
    </View>
  );
});

const linearColors = ['#25272D', '#3E414D'];

export const HeaderGradient = memo(
  ({ children, style }: { children?: ReactNode; style?: ViewStyle }) => {
    const height = useHeaderHeight();

    return (
      <View style={StyleSheet.flatten([{ overflow: 'visible' }, style])}>
        <LinearGradient
          locations={[0, 1]}
          colors={linearColors}
          useAngle={true}
          angle={180}
          style={StyleSheet.flatten([
            {
              height: Layout.window.height,
              position: 'absolute',
              bottom: 0,
              zIndex: -1,
              width: Layout.window.width,
            },
          ])}
        />
        <View
          style={StyleSheet.flatten([{ height: height + chartHeight + 124 }])}>
          {children}
        </View>
      </View>
    );
  },
);

type ChartHeaderProps = {
  data?: {
    list: ChartLine[];
    netChange?: string;
    netWorth?: string;
    netPercentage?: string;
    zeroAssets?: boolean;
    isUp?: boolean;
  } | null;
  totalValue?: string;
  selectedIndex: SharedValue<number>;
  isFinishOne?: boolean;
  isDataLoading?: boolean;
  style?: ViewStyle;
};

const ChartHeader = ({
  data,
  selectedIndex,
  style,
  totalValue,
  isFinishOne,
  isDataLoading,
}: ChartHeaderProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const containerStyle = useMemo(
    () => StyleSheet.flatten([styles.chartHeader, style]),
    [style, styles.chartHeader],
  );

  const title = useDerivedValue(() => {
    return data?.list?.[selectedIndex.value]?.timestamp
      ? formatDate(
          data?.list?.[selectedIndex.value]!.timestamp,
          'MMM DD, HH:mm',
        )
      : 'Net Worth';
  });

  const titleAnimatedProps = useAnimatedProps(() => {
    return {
      text: title.value,
    };
  });

  const netWorthText = useDerivedValue(() => {
    return selectedIndex.value > -1
      ? String(data?.list?.[selectedIndex.value]?.netWorth)
      : isFinishOne
      ? String(totalValue)
      : '';
  });

  const netWorthTextAnimatedProps = useAnimatedProps(() => {
    return {
      text: netWorthText.value,
    };
  });
  const earningStyle = useAnimatedStyle(() => {
    return {
      color: data?.zeroAssets
        ? colors.lightBlue
        : data?.list?.[selectedIndex.value]?.isUp ||
          (!data?.list?.[selectedIndex.value] && data?.isUp)
        ? ChartColor.green
        : ChartColor.red,
    };
  });

  const netChangeText = useDerivedValue(() => {
    return selectedIndex.value > -1
      ? String(data?.list?.[selectedIndex.value]?.change)
      : String(data?.netChange || '-');
  });
  const netChangeTextAnimatedProps = useAnimatedProps(() => {
    return {
      text: netChangeText.value,
    };
  });
  const changePecentageText = useDerivedValue(() => {
    return selectedIndex.value > -1
      ? String(data?.list?.[selectedIndex.value]?.changePecentage)
      : String(data?.netPercentage || '-');
  });
  const changePecentageTextAnimatedProps = useAnimatedProps(() => {
    return {
      text: changePecentageText.value,
    };
  });

  return (
    <View style={containerStyle}>
      <AnimateableText
        animatedProps={titleAnimatedProps}
        style={styles.title}
      />
      {isFinishOne ? (
        <AnimateableText
          style={styles.balance}
          animatedProps={netWorthTextAnimatedProps}
        />
      ) : (
        <NetWorthLoader />
      )}
      {isDataLoading ? (
        <ChangeLoader />
      ) : (
        <View style={styles.changeWrap}>
          <AnimateableText
            style={[styles.changes, earningStyle]}
            animatedProps={changePecentageTextAnimatedProps}
          />
          <AnimateableText
            style={[styles.pecentage, earningStyle]}
            animatedProps={netChangeTextAnimatedProps}
          />
        </View>
      )}
    </View>
  );
};

const getStyle = (colors: Colors) =>
  StyleSheet.create({
    container: {
      overflow: 'visible',
      paddingBottom: 20,
    },
    fixedTitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      overflow: 'hidden',
    },
    listTop: {
      position: 'absolute',
      bottom: -44,
      left: 0,
      right: 0,
      height: 48,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.bgChat,
    },
    fixTitleImg: {
      alignSelf: 'flex-end',
    },
    chartStyle: {
      height: chartHeight,
      opacity: 0.6,
    },
    chartHeader: {
      width: '100%',
      paddingHorizontal: 30,
      marginTop: 134,
      flexDirection: 'column',
    },
    title: {
      fontSize: 12,
      paddingBottom: 4,
      color: colord(colors.pureWhite).alpha(0.7).toHex(),
      fontWeight: '400',
    },
    balance: {
      fontSize: 28,
      color: colors.pureWhite,
      marginBottom: 4,
      fontWeight: '700',
      height: 30,
      overflow: 'visible',
      lineHeight: 30,
    },
    rightContent: {
      alignItems: 'flex-end',
    },
    changeWrap: {
      flexDirection: 'row',
    },
    changes: {
      fontSize: 15,
      fontWeight: '500',
    },
    pecentage: {
      marginLeft: 4,
      fontWeight: '400',
      alignSelf: 'center',
      fontSize: 13,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 20,
      paddingRight: 12,
      borderColor: colors.pureWhite,
    },
  });
