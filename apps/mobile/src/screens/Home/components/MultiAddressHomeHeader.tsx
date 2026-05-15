import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, Platform, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

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
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { IS_IOS } from '@/core/native/utils';
import {
  MultiChart,
  setIsFoldMultiChart,
} from '@/screens/Address/components/MultiAssets/RenderRow/CurveChart';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';
import { computeBalanceChange } from '@/core/apis/balance';
import { useHomeStartupReady } from '@/core/utils/homeStartupReady';
import { balance24hStore } from '@/store/balance24h';
import { useShallow } from 'zustand/react/shallow';
import { useHomePortfolioStore } from '../hooks/useHomePortfolioSummary';

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
  const shouldCoverLocalWebViewLoading =
    !startupReady ||
    showBalanceLoadingWithoutLocal ||
    showChangeLoadingWithoutLocal ||
    isCurveAnyAddrLoading;

  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { isDisConnect } = useGlobalStatus();

  const pinnedAccountList = usePinnedAccountList();
  const [hideType] = useHideBalance();

  const [couldRenderLocalWebView, setCouldRenderLocalWebView] = useState(false);

  const gasketWebViewRef = useRef<LocalWebView>(null);

  const { loadBalanceFromApiStage } =
    addressBalanceStore.useLoadBalanceFromApiStage();
  const previousLoading = usePrevious(loadBalanceFromApiStage);
  const [isAnimRunning, setIsAnimRunning] = useState(false);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!__DEV__ && data.isLoss) return;

    const durationMs = IS_IOS ? 2000 : 2500;

    if (
      data.rawChange &&
      loadBalanceFromApiStage !== 'loading' &&
      previousLoading === 'loading'
    ) {
      setIsAnimRunning(true);
      gasketWebViewRef.current?.sendMessage?.({
        type: 'GASKETVIEW:TOGGLE_LOADING',
        info: {
          loading: previousLoading,
          isPositive: !data.isLoss,
        },
        animationDurationMs: durationMs,
        animationGradientBorderRadius: SIZES.cardContentRadius,
      });
    }

    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
    }
    animTimerRef.current = setTimeout(
      () => setIsAnimRunning(false),
      durationMs,
    );
  }, [data.isLoss, data.rawChange, loadBalanceFromApiStage, previousLoading]);

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
          pointerEvents="none"
          style={[
            styles.localWebViewWrapper,
            couldRenderLocalWebView ? styles.localWebViewWrapperShow : {},
          ]}>
          <LocalWebView
            ref={gasketWebViewRef}
            style={[styles.curveBoxChildMH, styles.localWebView]}
            entryPath={'/pages/gasket-blurview.html'}
            // forceUseLocalResource
            webviewSize={{
              width: styles.localWebView.minWidth,
            }}
          />
        </View>
        <View
          style={[
            styles.curveBoxChildMH,
            styles.curveBox,
            // loading && styles.curveBoxLoading,
            {},
          ]}
          onLayout={event => {
            if (IS_IOS) {
              setTimeout(() => setCouldRenderLocalWebView(true), 500);
            } else {
              setCouldRenderLocalWebView(true);
            }
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
            style={[
              styles.curveCardGradientBg,
              isAnimRunning && styles.curveCardGradientBgWithAnim,
            ]}
          />
          <View
            style={[
              styles.curveCard,
              styles.shadowView,
              // !pinnedAccountList.length && styles.noAddressCard,
            ]}>
            {shouldCoverLocalWebViewLoading ? (
              <View pointerEvents="none" style={styles.curveCardCenterMask} />
            ) : null}
            <MultiChart
              hideType={hideType}
              onPressNetWorth={() => {
                apisHomeTabIndex.homeTabScrollerRef.current?.setIndex(1);
              }}
              onPressWalletList={handleWalletsListPress}
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
          </View>
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
    localWebViewWrapper: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: IS_IOS ? 1 : -1,
      marginHorizontal:
        isLight && IS_IOS ? 0 : SIZES.cardLayoutPaddingHorizontal,
      borderRadius: SIZES.cardContentRadius,
      display: 'none',
      // it helps to check the position of webview wrapper
      // if you see .localWebViewWrapper not filled by content in .curveBox, the sizes are wrong
      // uncomment below line to see the border
      // ...makeDebugBorder('green'),
    },
    localWebView: {
      minWidth: cardMinW,
      marginHorizontal: 'auto',
      backgroundColor: 'transparent',
    },
    localWebViewWrapperShow: {
      display: 'flex',
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
      borderRadius: SIZES.cardContentRadius,
      borderWidth: 1,
      borderColor: isLight ? 'rgba(255, 255, 255, 1)' : 'rgba(35, 36, 40, 1)',
    },
    curveCardGradientBgWithAnim: {
      borderColor: isLight ? 'rgba(255, 255, 255, .1)' : 'rgba(35, 36, 40, .1)',
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
