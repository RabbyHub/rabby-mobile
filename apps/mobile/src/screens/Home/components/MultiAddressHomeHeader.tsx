import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import addressBalanceStore from '@/store/balance';
import { matomoRequestEvent } from '@/utils/analytics';

import { BlurShadowView } from '@/components2024/BluerShadow';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { usePinnedAccountList } from '@/hooks/account';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { sortBy } from 'lodash';
import RNLinearGradient from 'react-native-linear-gradient';
import { BALANCE_HIDE_TYPE, useHideBalance } from '../hooks/useHideBalance';
import { HomeAddressItem } from './HomeAddressItem';
import {
  MultiChart,
  setIsFoldMultiChart,
} from '@/screens/Address/components/MultiAssets/RenderRow/CurveChart';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';
import { computeBalanceChange } from '@/core/apis/balance';
import { useHomeStartupReady } from '@/core/utils/homeStartupReady';
import { balance24hStore } from '@/store/balance24h';
import { useShallow } from 'zustand/react/shallow';
import { useHomePortfolioStore } from '../hooks/useHomePortfolioSummary';
import { useDebugHomeGasketNegativeGlow } from '@/hooks/appSettings';

const CONIC_SEGMENT_COUNT = 96;
const CONIC_PEAK_DEG = 180;
const CONIC_GLOW_PEAK_DEG = 90;
const CONIC_SPREAD_DEG = 90;
const GASKET_BORDER_WIDTH = 2;
const GASKET_GLOW_BORDER_WIDTH = 5;

function getConicOpacity(angleDeg: number, peakDeg: number) {
  const diff = Math.abs(((angleDeg - peakDeg + 540) % 360) - 180);
  return Math.max(0, 1 - diff / CONIC_SPREAD_DEG);
}

function getConicPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number,
) {
  const rad = (angleDeg * Math.PI) / 180;

  return {
    x: centerX + Math.sin(rad) * radius,
    y: centerY - Math.cos(rad) * radius,
  };
}

function makeConicSectorPath({
  centerX,
  centerY,
  radius,
  startDeg,
  endDeg,
}: {
  centerX: number;
  centerY: number;
  radius: number;
  startDeg: number;
  endDeg: number;
}) {
  const start = getConicPoint(centerX, centerY, radius, startDeg);
  const end = getConicPoint(centerX, centerY, radius, endDeg);

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function NativeGasketGlow({
  width,
  height,
  radius,
  running,
  durationMs,
  isPositive,
  isLight,
  style,
}: {
  width: number;
  height: number;
  radius: number;
  running: boolean;
  durationMs: number;
  isPositive: boolean;
  isLight: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);
  const gradientSize = Math.ceil(Math.sqrt(width * width + height * height));
  const gradientOffsetX = (width - gradientSize) / 2;
  const gradientOffsetY = (height - gradientSize) / 2;
  const colorRgb = isPositive ? '88, 198, 105' : '227, 73, 53';
  const mainOpacity = isLight ? 0.6 : 0.4;
  const glowOpacity = isLight ? 0.18 : 0.14;
  const center = gradientSize / 2;
  const sectorRadius = gradientSize;
  const sectorStep = 360 / CONIC_SEGMENT_COUNT;
  const conicSectors = useMemo(
    () =>
      Array.from({ length: CONIC_SEGMENT_COUNT }, (_, index) => {
        const startDeg = index * sectorStep;
        const endDeg = startDeg + sectorStep;
        const midDeg = startDeg + sectorStep / 2;
        const mainAlpha =
          getConicOpacity(midDeg, CONIC_PEAK_DEG) * mainOpacity;
        const glowAlpha =
          getConicOpacity(midDeg, CONIC_GLOW_PEAK_DEG) * glowOpacity;
        const d = makeConicSectorPath({
          centerX: center,
          centerY: center,
          radius: sectorRadius,
          startDeg,
          endDeg,
        });

        return {
          key: `${startDeg}`,
          d,
          mainFill: `rgba(${colorRgb}, ${mainAlpha})`,
          glowFill: `rgba(${colorRgb}, ${glowAlpha})`,
          mainAlpha,
          glowAlpha,
        };
      }).filter(item => item.mainAlpha > 0.001 || item.glowAlpha > 0.001),
    [
      center,
      colorRgb,
      glowOpacity,
      mainOpacity,
      sectorRadius,
      sectorStep,
    ],
  );
  const glowRotatingCanvasStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 360}deg` }],
    };
  });
  const mainRotatingCanvasStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 360}deg` }],
    };
  });

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;

    if (!running) {
      return;
    }

    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.linear,
    });

    return () => {
      cancelAnimation(progress);
    };
  }, [durationMs, progress, running]);

  if (!running || width <= 0 || height <= 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[stylesNativeGasket.container, style]}>
      <MaskedView
        androidRenderingMode="hardware"
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={[stylesNativeGasket.maskRoot, { width, height }]}>
            <View
              style={[
                stylesNativeGasket.maskRing,
                {
                  borderRadius: radius,
                  borderWidth: GASKET_GLOW_BORDER_WIDTH,
                },
              ]}
            />
          </View>
        }>
        <Animated.View
          style={[
            stylesNativeGasket.conicCanvas,
            {
              width: gradientSize,
              height: gradientSize,
              left: gradientOffsetX,
              top: gradientOffsetY,
            },
            glowRotatingCanvasStyle,
          ]}>
          <Svg width={gradientSize} height={gradientSize}>
            {conicSectors.map(item => (
              <Path key={`glow-${item.key}`} d={item.d} fill={item.glowFill} />
            ))}
          </Svg>
        </Animated.View>
      </MaskedView>

      <MaskedView
        androidRenderingMode="hardware"
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={[stylesNativeGasket.maskRoot, { width, height }]}>
            <View
              style={[
                stylesNativeGasket.maskRing,
                {
                  borderRadius: radius,
                  borderWidth: GASKET_BORDER_WIDTH,
                },
              ]}
            />
          </View>
        }>
        <Animated.View
          style={[
            stylesNativeGasket.conicCanvas,
            {
              width: gradientSize,
              height: gradientSize,
              left: gradientOffsetX,
              top: gradientOffsetY,
            },
            mainRotatingCanvasStyle,
          ]}>
          <Svg width={gradientSize} height={gradientSize}>
            {conicSectors.map(item => (
              <Path key={`main-${item.key}`} d={item.d} fill={item.mainFill} />
            ))}
          </Svg>
        </Animated.View>
      </MaskedView>
    </View>
  );
}

const stylesNativeGasket = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  maskRoot: {
    backgroundColor: 'transparent',
  },
  maskRing: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'black',
    backgroundColor: 'transparent',
  },
  conicCanvas: {
    position: 'absolute',
  },
});

function MultiPinnedAddressList({
  pinnedAccountList,
  hideType,
}: {
  pinnedAccountList: ReturnType<typeof usePinnedAccountList>;
  hideType: BALANCE_HIDE_TYPE;
}) {
  const { styles } = useTheme2024({ getStyle });
  const pinnedAddresses = useMemo(() => {
    return pinnedAccountList.map(item => item.address.toLowerCase());
  }, [pinnedAccountList]);
  const balance24hSnapshots =
    balance24hStore.useAddresses24hBalanceSnapshots(pinnedAddresses);

  const addressListData = useMemo(() => {
    const multi24hBalance = balance24hSnapshots.reduce(
      (acc, snapshot) => {
        if (snapshot.value) {
          acc[snapshot.address] = snapshot.value;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          total_usd_value?: number;
          updateTime?: number;
        }
      >,
    );

    return sortBy(
      pinnedAccountList.map(item => {
        const lcAddr = item.address.toLowerCase();
        const address24hBalanceData = multi24hBalance[lcAddr];
        const canShowChange =
          !!address24hBalanceData && typeof item.evmBalance === 'number';
        const total_usd_value = address24hBalanceData?.total_usd_value || 0;
        const { assetsChange, changePercent } = computeBalanceChange(
          item.evmBalance || 0,
          total_usd_value,
        );

        return {
          ...item,
          updateTime: address24hBalanceData?.updateTime,
          balance: item.balance || 0,
          evmBalance: item.evmBalance || 0,
          changePercent: canShowChange ? changePercent : undefined,
          isLoss: canShowChange ? assetsChange < 0 : undefined,
        };
      }),
      item => -(item.balance || 0),
    ).slice(0, 3);
  }, [balance24hSnapshots, pinnedAccountList]);

  useEffect(() => {
    if (!addressListData?.length) {
      return;
    }
    matomoRequestEvent({
      category: 'Pin Address',
      action: 'PinAddress_Active',
      label: `PinAddress_${addressListData?.length}`,
    });
  }, [addressListData?.length]);

  return (
    <View
      style={[
        styles.accountList,
        hideType === 'HALF_HIDE' ? styles.addressOpacity : null,
      ]}>
      {addressListData?.map(item => {
        return (
          <HomeAddressItem
            hideType={hideType}
            account={item}
            updateTime={item.updateTime}
            key={`${item.type}-${item.address}`}
            isLoss={item.isLoss}
            changePercent={item.changePercent}
          />
        );
      })}
    </View>
  );
}

export function MultiAddressHomeHeader(
  props: {
    onRefresh?: () => void;
  } & RNViewProps,
): JSX.Element {
  const { style, onRefresh } = props;
  const {
    changeData: data,
    showBalanceLoadingWithoutLocal,
    showChangeLoadingWithoutLocal,
    isCurveAnyAddrLoading,
  } = useHomePortfolioStore(
    useShallow(state => ({
      changeData: state.changeData,
      showBalanceLoadingWithoutLocal: state.showBalanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal: state.showChangeLoadingWithoutLocal,
      isCurveAnyAddrLoading: state.isCurveAnyAddrLoading,
    })),
  );
  const startupReady = useHomeStartupReady();
  const shouldCoverHomeCardLoading =
    !startupReady ||
    showBalanceLoadingWithoutLocal ||
    showChangeLoadingWithoutLocal ||
    isCurveAnyAddrLoading;

  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { isDisConnect } = useGlobalStatus();
  const { debugHomeGasketNegativeGlow } = useDebugHomeGasketNegativeGlow();

  const pinnedAccountList = usePinnedAccountList();
  const [hideType] = useHideBalance();

  const [gasketSize, setGasketSize] = useState({ width: 0, height: 0 });

  const { loadBalanceFromApiStage } =
    addressBalanceStore.useLoadBalanceFromApiStage();
  const previousLoading = usePrevious(loadBalanceFromApiStage);
  const [isAnimRunning, setIsAnimRunning] = useState(false);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationDurationMs = Platform.OS === 'ios' ? 2000 : 2500;
  useEffect(() => {
    const shouldRunGasketGlow = !data.isLoss || debugHomeGasketNegativeGlow;

    if (
      data.rawChange &&
      loadBalanceFromApiStage !== 'loading' &&
      previousLoading === 'loading'
    ) {
      if (!shouldRunGasketGlow) {
        setIsAnimRunning(false);

        if (animTimerRef.current) {
          clearTimeout(animTimerRef.current);
          animTimerRef.current = null;
        }

        return;
      }

      setIsAnimRunning(true);

      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
      }
      animTimerRef.current = setTimeout(
        () => setIsAnimRunning(false),
        animationDurationMs,
      );
    }
  }, [
    animationDurationMs,
    debugHomeGasketNegativeGlow,
    data.isLoss,
    data.rawChange,
    loadBalanceFromApiStage,
    previousLoading,
  ]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  const modalRef =
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>(undefined);

  const handleWalletsListPress = useCallback(() => {
    setIsFoldMultiChart(true);
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
    matomoRequestEvent({
      category: 'Click_Header',
      action: 'Click_Address',
    });
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_LiST,
      onAddAddressPress: () => {
        if (modalRef.current) {
          removeGlobalBottomSheetModal2024(modalRef.current);
        }
        apiGlobalModal.showAddSelectMethodModal();
      },
      bottomSheetModalProps: {
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      onDone: () => {
        removeGlobalBottomSheetModal2024(modalRef.current);
        modalRef.current = undefined;
      },
    });
  }, [colors2024, isLight]);

  return (
    <View style={[styles.container, style]}>
      <GlobalWarning
        hasError={isDisConnect}
        // // leave here for debug
        // {...__DEV__ && { hasError: true }}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => {
          onRefresh?.();
        }}
      />
      <BlurShadowView
        isLight={isLight}
        viewTypeOnNoShadow="view"
        viewProps={{
          style: [styles.homecardWrapper],
        }}>
        <View
          style={[
            styles.curveBoxChildMH,
            styles.curveBox,
            // loading && styles.curveBoxLoading,
            {},
          ]}
          onLayout={(event: LayoutChangeEvent) => {
            const { width, height } = event.nativeEvent.layout;

            setGasketSize(prev => {
              if (prev.width === width && prev.height === height) {
                return prev;
              }

              return { width, height };
            });
          }}>
          <RNLinearGradient
            pointerEvents="none"
            colors={
              isLight
                ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, .54)']
                : ['rgba(0, 0, 0, 0.10)', '#232428']
            }
            start={isLight ? { x: 0.25, y: 0.5 } : { x: 1.07, y: 0.42 }}
            end={isLight ? { x: 0.75, y: 0.5 } : { x: -0.14, y: 0.59 }}
            style={styles.curveCardGradientBg}
          />
          <NativeGasketGlow
            width={gasketSize.width}
            height={gasketSize.height}
            radius={SIZES.cardContentRadius}
            running={isAnimRunning}
            durationMs={animationDurationMs}
            isPositive={!data.isLoss}
            isLight={isLight}
            style={[styles.curveBoxChildMH, styles.nativeGasketGlow]}
          />
          <TouchableOpacity
            style={[
              styles.curveCard,
              styles.shadowView,
              // !pinnedAccountList.length && styles.noAddressCard,
            ]}
            onPress={() => {
              handleWalletsListPress();
            }}>
            {shouldCoverHomeCardLoading ? (
              <View pointerEvents="none" style={styles.curveCardCenterMask} />
            ) : null}
            <MultiChart
              hideType={hideType}
              style={[
                styles.multiChart,
                !pinnedAccountList?.length && styles.multiChartNoAccountsFollow,
              ]}
            />
            {pinnedAccountList?.length ? (
              <MultiPinnedAddressList
                hideType={hideType}
                pinnedAccountList={pinnedAccountList}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </BlurShadowView>
    </View>
  );
}

const SIZES = {
  cardLayoutPaddingHorizontal: 16,
  cardContentRadius: 20,
  curveBoxWrapperPy: 0,
  curveBoxPx: 0,
  curveBoxPy: 0,
  curveCardMinHeight: 62,
  get curveBoxMinHeight() {
    return SIZES.curveCardMinHeight;
  },
  get homecardMinHeight() {
    return SIZES.curveCardMinHeight + SIZES.curveBoxWrapperPy * 2;
  },
  // pratical value, to keep padding inside curve box
  curveCardPy: 0,
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  const curveBoxBorderWidth = 1;
  const curveCardBorderWidth = !isLight ? 2 : 1;
  const cardMinW =
    Dimensions.get('window').width - SIZES.cardLayoutPaddingHorizontal * 2;

  return {
    container: {
      marginTop: 0,
      paddingVertical: 0,
      width: '100%',
    },
    homecardWrapper: {
      position: 'relative',
      paddingTop: 0,
      backgroundColor: 'transparent',
      paddingVertical: 0,
      paddingHorizontal: SIZES.cardLayoutPaddingHorizontal,
      minHeight: SIZES.homecardMinHeight,
      borderRadius: SIZES.cardContentRadius,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    nativeGasketGlow: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 3,
      borderRadius: SIZES.cardContentRadius,
      overflow: 'hidden',
    },
    curveBoxWrapperLoading: {},
    curveBoxChildMH: {
      minHeight: SIZES.curveBoxMinHeight,
    },
    curveBox: {
      paddingHorizontal: SIZES.curveBoxPx,
      paddingVertical: SIZES.curveBoxPy,
      borderWidth: isLight ? curveCardBorderWidth : 0,
      borderColor: 'transparent',
      borderRadius: SIZES.cardContentRadius,
      minWidth: cardMinW,
      width: '100%',
      alignItems: 'center',
      position: 'relative',
    },
    curveBoxLoading: {},
    curveCard: {
      overflow: 'visible',
      borderStyle: 'solid',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      width: '100%',
      maxWidth: '100%',
      zIndex: 2,
      borderRadius: 0,
      minHeight: SIZES.curveCardMinHeight,
      paddingVertical: SIZES.curveCardPy,
      paddingHorizontal: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      // ...makeDebugBorder('purple'),
    },
    curveCardCenterMask: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: SIZES.cardContentRadius,
      backgroundColor: isLight ? colors2024['neutral-bg-0'] : '#232428',
    },
    noAddressCard: {
      paddingBottom: 20,
    },
    curveCardGradientBg: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 0,
      borderRadius: SIZES.cardContentRadius,
      borderWidth: 1,
      borderColor: isLight ? 'rgba(255, 255, 255, 1)' : 'rgba(35, 36, 40, 1)',
    },
    shadowView: {
      ...Platform.select({
        ios: {
          shadowColor: colors2024['neutral-black'],
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.03,
          shadowRadius: 10,
          elevation: 8,
        },
      }),
    },
    globalWarning: {
      marginHorizontal: 16,
      marginBottom: 16,
    },

    multiChart: {
      paddingTop: 16,
      paddingHorizontal: 16,
      width: '100%',
      minWidth: cardMinW,
    },

    multiChartNoAccountsFollow: {
      marginBottom: 20,
    },

    accountList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%',
      marginTop: 20,
      paddingHorizontal: 8,
      marginBottom: 12,
    },
    addressOpacity: {
      opacity: 0.3,
    },
    hidden: {
      display: 'none',
    },
  };
});
