import { useTheme2024 } from '@/hooks/theme';
import { formatPrice } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import * as d3Shape from 'd3-shape';
import dayjs from 'dayjs';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  ImageBackground,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { CurveLoader } from './CurveLoader';
import { DataHeaderInfo, DataHeaderInfoSkeleton } from './DataHeaderInfo';
import { REAL_TIME_TAB_LIST, TabKey, TIME_TAB_LIST, TimeTab } from './TimeTab';
import {
  formatTokenDateCurve,
  use24hCurveData,
  useDateCurveData,
} from './useCurve';
import { RelatedDeFiType, TokenFromAddressItem } from '../..';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { unionBy } from 'lodash';
import { CurvePoint } from '@/hooks/useCurve';
import { ITokenItem } from '@/store/tokens';
const DATE_FORMATTER = 'MMM DD, YYYY';

const isRealTimeKey = (key: TabKey) => REAL_TIME_TAB_LIST.includes(key);

const winInfo = Dimensions.get('window');

interface Props {
  token: ITokenItem;
  finalAccount?: KeyringAccountWithAlias | null;
  amountList: TokenFromAddressItem[];
  isSingleAddress?: boolean;
  relateDefiList?: RelatedDeFiType[];
  onUpChange?: (isUp: boolean) => void;
  extraMetaInfo?: React.ReactNode;
}
export type TokenChartRef = {
  refreshChart: () => void;
};
export const TokenPriceChart = forwardRef<TokenChartRef, Props>(
  (props, ref) => {
    const {
      token,
      isSingleAddress,
      amountList,
      finalAccount,
      relateDefiList,
      extraMetaInfo,
      onUpChange,
    } = props;
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    const [priceType, setPriceType] = useState<'price' | 'holding'>('price');
    const [activeKey, setActiveKey] = useState<TabKey>(TIME_TAB_LIST[0].key);
    const [ready, setReady] = useState(false);
    const amountSum = useMemo(() => {
      let deFiAmount = 0;
      relateDefiList?.forEach(item => {
        deFiAmount += item.amount;
      });

      if (isSingleAddress) {
        const tokenAmount = amountList.find(
          item => item.address === finalAccount?.address,
        )?.amount;
        return (tokenAmount || 0) + deFiAmount;
      } else {
        const amountUnionBy = unionBy(amountList, item =>
          item.address.toLowerCase(),
        );
        const totalTokenAmount = amountUnionBy.reduce((acc, item) => {
          return acc + item.amount;
        }, 0);

        return totalTokenAmount + deFiAmount;
      }
    }, [amountList, isSingleAddress, relateDefiList, finalAccount?.address]);

    const amount = useMemo(
      () => (priceType === 'holding' ? amountSum : 1),
      [priceType, amountSum],
    );

    const {
      data: realTimeData,
      loading: curveLoading,
      refreshAsync: refreshAsyncRealTimeData,
    } = use24hCurveData({
      tokenId: token.id,
      serverId: token.chain,
      days: activeKey === '24h' ? 1 : 7,
      amount,
    });
    const {
      data: dateCurveData,
      loading: timeMachineLoading,
      refreshAsync: refreshAsyncDateCurveData,
    } = useDateCurveData({
      tokenId: token.id,
      serverId: token.chain,
      ready: ready,
    });

    const handleRefresh = useCallback(() => {
      if (isRealTimeKey(activeKey)) {
        refreshAsyncRealTimeData?.();
      } else {
        refreshAsyncDateCurveData?.();
      }
    }, [activeKey, refreshAsyncRealTimeData, refreshAsyncDateCurveData]);

    useImperativeHandle(
      ref,
      () => ({
        refreshChart: handleRefresh,
      }),
      [handleRefresh],
    );

    const timeMachMapping = useMemo(() => {
      let result = {} as Record<
        Exclude<TabKey, '24h' | '1W'>,
        ReturnType<typeof formatTokenDateCurve>
      >;
      TIME_TAB_LIST.forEach(e => {
        if (!isRealTimeKey(e.key) && dateCurveData) {
          result[e.key] = formatTokenDateCurve(
            e.value,
            dateCurveData as any,
            amount,
          );
        }
      });
      return result;
    }, [dateCurveData, amount]);

    const data = useMemo(() => {
      if (isRealTimeKey(activeKey)) {
        return realTimeData;
      }
      return timeMachMapping[activeKey as keyof typeof timeMachMapping];
    }, [activeKey, realTimeData, timeMachMapping]);

    useEffect(() => {
      if (data?.list?.length) {
        onUpChange?.(
          data?.list?.[0]?.value < data?.list?.[data?.list?.length - 1]?.value,
        );
      }
    }, [data?.list, onUpChange]);

    const { isUp, percent } = useMemo(() => {
      if (data?.list?.length) {
        const pre = data?.list?.[0]?.value;
        const now = data?.list?.[data?.list?.length - 1]?.value;
        let isLoss = now < pre;
        let currentPercent = '';
        if (activeKey === '24h') {
          isLoss = token?.price_24h_change
            ? Number(token.price_24h_change) < 0
            : false;
          currentPercent = token?.price_24h_change
            ? Math.abs((token?.price_24h_change || 0) * 100).toFixed(2) + '%'
            : '';
        } else {
          currentPercent =
            pre === 0
              ? now === 0
                ? '0%'
                : '100%'
              : Math.abs(((now - pre) / pre) * 100).toFixed(2) + '%';
        }
        return {
          isUp: !isLoss,
          percent: currentPercent,
        };
      }
      return {
        isUp: token.price_24h_change
          ? Number(token.price_24h_change) > 0
          : true,
        percent: token?.price_24h_change
          ? Math.abs((token?.price_24h_change || 0) * 100).toFixed(2) + '%'
          : '',
      };
    }, [activeKey, data?.list, token?.price_24h_change]);

    const pathColor = isUp
      ? colors2024['green-default']
      : colors2024['red-default'];

    const currentInfo = useMemo(() => {
      const price =
        priceType === 'holding' ? token.price * amountSum : token.price;
      // price_24h_change will loss some zero point
      const oneDayIsLoss = token.price_24h_change
        ? Number(token.price_24h_change) < 0
        : false;
      return {
        date: dayjs().format(DATE_FORMATTER),
        balance: '$' + formatPrice(price || 0, 8, true),
        isLoss: activeKey === '24h' ? oneDayIsLoss : !!data?.isLoss,
        percent: percent,
      };
    }, [data?.isLoss, percent, amountSum, priceType, activeKey, token]);

    return (
      <View>
        <View style={styles.flexWrap}>
          {Boolean(amountList.length) && (
            <View style={styles.priceTabWrapper}>
              <TouchableOpacity
                onPress={() => {
                  setPriceType('price');
                }}>
                <View
                  style={[
                    styles.item,
                    priceType === 'price' ? styles.itemActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.itemText,
                      priceType === 'price' ? styles.activeText : null,
                    ]}>
                    {t('page.tokenDetail.Price')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPriceType('holding');
                }}>
                <View
                  style={[
                    styles.item,
                    priceType === 'holding' ? styles.itemActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.itemText,
                      priceType === 'holding' ? styles.activeText : null,
                    ]}>
                    {t('page.tokenDetail.HoldingValue')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {TIME_TAB_LIST.map(e => (
          <View key={e.key} style={activeKey !== e.key && styles.hidden}>
            <Chart
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
              extraMetaInfo={extraMetaInfo}
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
  },
);

function Chart({
  data,
  activeKey,
  currentInfo,
  loading,
  pathColor,
  extraMetaInfo,
}: {
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
  extraMetaInfo?: React.ReactNode;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <LineChart.Provider data={data}>
      {loading ? (
        <DataHeaderInfoSkeleton />
      ) : (
        <DataHeaderInfo
          key={activeKey}
          activeKey={activeKey}
          currentPercentChange={currentInfo.percent}
          currentIsLoss={currentInfo.isLoss}
          currentBalance={currentInfo.balance}
          data={data}
        />
      )}

      {loading ? null : data?.length ? extraMetaInfo : null}

      {loading ? (
        <CurveLoader />
      ) : data?.length ? (
        <>
          <LineChart
            height={114}
            width={winInfo.width - 32}
            shape={d3Shape.curveCatmullRom}
            style={styles.chart}>
            <LineChart.Path
              showInactivePath={false}
              color={pathColor}
              width={2}>
              <LineChart.Gradient color={pathColor} />
            </LineChart.Path>
            <LineChart.CursorLine color={colors2024['neutral-line']} />
            <LineChart.CursorCrosshair
              color={pathColor}
              outerSize={12}
              size={8}
            />
          </LineChart>
        </>
      ) : (
        <ImageBackground
          source={require('@/assets2024/singleHome/ImgEmptyChart.png')}
          resizeMode="cover"
          style={styles.emptyChart}
        />
        // <View style={styles.empty} />
      )}
    </LineChart.Provider>
  );
}

const Mask = ({ xOffset }: { xOffset: SharedValue<number> }) => {
  const { colors2024, isLight } = useTheme2024();
  const styles = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
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
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  chart: {
    position: 'relative',
    marginHorizontal: 16,
    // backgroundColor: '#440000',
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
    color: colors2024['neutral-foot'],
  },
  hidden: {
    display: 'none',
  },
  dateTime: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    paddingTop: 0,
  },
  empty: {
    height: 115,
  },
  item: {
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    // borderRadius: 120,
  },
  flexWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemText: {
    flexShrink: 1,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemActive: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-4'],
    borderRadius: 120,
  },
  priceTabWrapper: {
    flexShrink: 1,
    // flexBasis: 0,
    gap: 2,
    // width: 'auto',
    marginLeft: 20,
    borderRadius: 120,
    marginBottom: 8,
    flexDirection: 'row',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    paddingHorizontal: 4,
    paddingVertical: 4,
    // justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyChart: {
    width: winInfo.width - 40,
    height: 115,
    // marginTop: 24,
    marginHorizontal: 20,
  },
}));
