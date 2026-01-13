import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';

import useAccountsBalance, {
  useLoadBalanceFromApiStage,
} from '@/hooks/useAccountsBalance';
import { matomoRequestEvent } from '@/utils/analytics';

import { BlurShadowView } from '@/components2024/BluerShadow';
import { Card } from '@/components2024/Card';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { usePinnedAccountList } from '@/hooks/account';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { sortBy } from 'lodash';
import RNLinearGradient from 'react-native-linear-gradient';
import { BALANCE_HIDE_TYPE, useHideBalance } from '../hooks/useHideBalance';
import { HomeAddressItem } from './HomeAddressItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
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
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  useScene24hBalanceCombinedData,
  useScene24hBalanceMulti24hBalance,
  useSceneIsLoading,
} from '@/hooks/useScene24hBalance';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';

function MultiPinnedAddressList({
  pinnedAccountList,
  hideType,
}: {
  pinnedAccountList: ReturnType<typeof usePinnedAccountList>;
  hideType: BALANCE_HIDE_TYPE;
}) {
  const { styles } = useTheme2024({ getStyle });

  const { balanceAccounts } = useAccountsBalance();
  const { multi24hBalance } = useScene24hBalanceMulti24hBalance('Home');

  const addressListData = useMemo(() => {
    return sortBy(
      pinnedAccountList.map(item => {
        const lcAddr = item.address.toLowerCase();
        const address24hBalanceData = multi24hBalance[lcAddr];
        const balanceAccount = balanceAccounts?.[lcAddr];
        const total_usd_value = address24hBalanceData?.total_usd_value || 0;
        const assetsChange =
          (balanceAccount?.evmBalance || 0) - total_usd_value;
        let changePercent =
          total_usd_value !== 0
            ? `${Math.abs((assetsChange * 100) / total_usd_value).toFixed(2)}%`
            : `${balanceAccount?.evmBalance === 0 ? '0' : '100.00'}%`;

        return {
          ...item,
          updateTime: address24hBalanceData?.updateTime,
          balance: balanceAccount?.balance || item.balance || 0,
          evmBalance: balanceAccount?.evmBalance || item.evmBalance || 0,
          changePercent: address24hBalanceData ? changePercent : undefined,
          isLoss: address24hBalanceData ? assetsChange < 0 : undefined,
        };
      }),
      item => -(item.balance || 0),
    ).slice(0, 3);
  }, [pinnedAccountList, multi24hBalance, balanceAccounts]);

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

  const { combinedData: data } = useScene24hBalanceCombinedData('Home');
  const { isLoading: loading } = useSceneIsLoading('Home');

  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { isDisConnect } = useGlobalStatus();

  const pinnedAccountList = usePinnedAccountList();
  const [hideType] = useHideBalance();

  const [couldRenderLocalWebView, setCouldRenderLocalWebView] = useState(false);

  const gasketWebViewRef = useRef<LocalWebView>(null);

  const { loadBalanceFromApiStage } = useLoadBalanceFromApiStage();
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
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>();

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
    <View style={style}>
      <GlobalWarning
        hasError={isDisConnect}
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
          style: [styles.curveBoxWrapper, { minHeight: 100 }],
        }}>
        <View
          pointerEvents="none"
          style={[
            styles.localWebViewWrapper,
            couldRenderLocalWebView ? styles.localWebViewWrapperShow : {},
          ]}>
          <LocalWebView
            ref={gasketWebViewRef}
            style={{
              minWidth: Dimensions.get('window').width - 15 * 2,
              minHeight: 100,
              marginHorizontal: 'auto',
              backgroundColor: 'transparent',
            }}
            entryPath={'/pages/gasket-blurview.html'}
            // forceUseLocalResource
            webviewSize={{
              width: Dimensions.get('window').width - 15 * 2,
            }}
          />
        </View>
        <RNLinearGradient
          colors={
            isLight
              ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.6)']
              : ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']
          }
          style={[
            styles.curveBox,
            loading && styles.curveBoxLoading,
            {
              position: 'relative',
            },
            !isLight && { borderWidth: 0 },
            {},
          ]}
          onLayout={() => {
            if (IS_IOS) {
              setTimeout(() => setCouldRenderLocalWebView(true), 500);
            } else {
              setCouldRenderLocalWebView(true);
            }
          }}>
          <Card
            style={[
              styles.curveCard,
              styles.shadowView,
              !pinnedAccountList.length && styles.noAddressCard,
            ]}
            onPress={() => {
              handleWalletsListPress();
            }}>
            <RNLinearGradient
              colors={
                isLight
                  ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.6)']
                  : ['rgba(0, 0, 0, 0.40)', 'rgba(0, 0, 0, 0.10)']
              }
              start={isLight ? { x: 0.25, y: 0.5 } : { x: 0.02, y: 1.04 }}
              end={isLight ? { x: 0.75, y: 0.5 } : { x: 1, y: 0.1 }}
              style={[
                StyleSheet.absoluteFill,
                styles.curveCardGradientBg,
                isAnimRunning && styles.curveCardGradientBgWithAnim,
              ]}
            />
            <MultiChart hideType={hideType} />
            {pinnedAccountList?.length ? (
              <MultiPinnedAddressList
                hideType={hideType}
                pinnedAccountList={pinnedAccountList}
              />
            ) : null}
            {hideType === 'HALF_HIDE' ? (
              <View style={styles.accountCardMask}>
                {/* {Platform.OS === 'ios' ? (
                    <BlurView
                      style={styles.accountCardMaskBlur}
                      blurAmount={1.5}
                      blurType={isLight ? 'light' : 'dark'}
                      reducedTransparencyFallbackColor="white"
                    />
                  ) : null} */}
              </View>
            ) : null}
          </Card>
        </RNLinearGradient>
      </BlurShadowView>
    </View>
  );
}

const SIZES = {
  cardLayoutPaddingHorizontal: 16 /* ITEM_LAYOUT_PADDING_HORIZONTAL */,
  cardContentRadius: 20,
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  const curveBoxBorderWidth = 1;
  const curveCardBorderWidth = !isLight ? 2 : 1;

  return {
    screenContainer: {
      paddingTop: 64,
    },
    paddingContainer: {
      paddingHorizontal: 0,
      flex: 1,
      flexGrow: 1,
    },
    bgImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    usdText: {
      fontSize: 36,
      fontWeight: '900',
      textAlign: 'left',
      color: colors2024['neutral-title-1'],
      lineHeight: 42,
      fontFamily: 'SF Pro Rounded',
    },

    accountCardMask: {
      position: 'absolute',
      left: 1,
      right: 1,
      bottom: 1,
      top: 1,
      zIndex: 10,
      pointerEvents: 'none',
      backgroundColor: isLight
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.02)',
    },
    accountCardMaskBlur: {
      height: '100%',
      borderRadius: 20,
    },
    curveBoxWrapper: {
      position: 'relative',
      marginTop: 12,
      paddingTop: 0,
      backgroundColor: 'transparent',
      // ...makeDebugBorder('red'),
      paddingHorizontal: SIZES.cardLayoutPaddingHorizontal,
      borderRadius: SIZES.cardContentRadius,
      alignItems: 'center',
      justifyContent: 'center',
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
      // ...makeDebugBorder('yellow'),
    },
    localWebViewWrapperShow: {
      display: 'flex',
    },
    curveBoxWrapperLoading: {},
    curveBox: {
      // ...makeDevOnlyStyle({
      //   opacity: 0,
      // }),
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingVertical: 0,
      padding: 0,
      borderWidth: curveBoxBorderWidth,
      borderColor: 'transparent',
      borderRadius: 20,
      // ...makeDebugBorder(),
      width: '100%',
      alignItems: 'center',
    },
    curveBoxLoading: {},
    curveCard: {
      maxWidth: '100%',
      // flexDirection: 'row',
      // alignItems: 'center',
      // justifyContent: 'space-between',

      borderRadius: 20,
      paddingVertical: 24,
      paddingHorizontal: 0,
      borderWidth: 0,
      borderColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-line'],
      backgroundColor: 'transparent',

      position: 'relative',
    },
    noAddressCard: {
      paddingBottom: 20,
    },
    curveCardGradientBg: {
      ...(!isLight && {
        borderWidth: 2,
        borderColor: 'rgba(37, 38, 40, 1)',
        borderRadius: 20,
      }),
    },
    curveCardGradientBgWithAnim: {
      ...(!isLight && {
        borderColor: 'rgba(37, 38, 40, 0.1)',
      }),
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
      marginTop: 16,
      // marginBottom: -16,
    },

    accountList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%',
      marginTop: 28,
      paddingHorizontal: 8,
    },
    addressOpacity: {
      opacity: 0.3,
    },
    hidden: {
      display: 'none',
    },
  };
});
