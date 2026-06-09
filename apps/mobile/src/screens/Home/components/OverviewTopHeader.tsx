import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { E2E_ID } from '@/constant/e2e';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { useUpgradeInfo } from '@/hooks/version';
import { matomoRequestEvent } from '@/utils/analytics';

import RcIconEyeCC from '@/assets2024/icons/home/eye-cc.svg';
import RcIconEyeCloseCC from '@/assets2024/icons/home/eye-close-cc.svg';
import RcIconEyeHalfCloseCC from '@/assets2024/icons/home/eye-half-close-cc.svg';
import { FeedbackEntryOnHeader } from '@/components/Screenshot/FeedbackEntryOnHeader';
import {
  HOME_TOP_HEADER_SIZES,
  ITEM_LAYOUT_PADDING_HORIZONTAL,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { useMemoizedFn } from 'ahooks';
import { useHideBalance } from '../hooks/useHideBalance';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { AddressListScreenButton } from '@/screens/Address/AddressListScreenButton';
import { useCurrency } from '@/hooks/useCurrency';
import { formatSmallCurrencyValueParts } from '@/utils/currency';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import IconPerpEdit from '@/assets2024/icons/perps/icon-switch-mode.svg';
import useTokenList from '@/store/tokens';
import { useHomeDrawerOpacityStyle } from '../hooks/useHomeDrawerAnimate';
import { IS_ANDROID } from '@/core/native/utils';
import { Text } from '@/components/Typography';
import { useReportTokenTabView } from '../hooks/useReportTokenTabView';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { useHomePortfolioStore } from '../hooks/useHomePortfolioSummary';
import { useShallow } from 'zustand/react/shallow';
import { MultiHeaderRightHistory } from '../MultiHeaderRightHistory';
import AnimatedTickerText from '@/components/Animated/AnimatedTickerText';
import { useValueFromSharedValue } from '@/hooks/reanimated';

const HeaderHeight = 30;
const handleSwitchToTokenTab = (index: number) => {
  apisHomeTabIndex.setTabIndex(index, true);
};

export function TabsTopHeader(): JSX.Element {
  const focusedTab = useValueFromSharedValue(apisHomeTabIndex.svTabName);

  const {
    totalBalance,
    showBalanceLoadingWithoutLocal,
    showChangeLoadingWithoutLocal,
    isAnyRemoteRefreshing,
    isChangeAnyLoading,
    changeData,
  } = useHomePortfolioStore(
    useShallow(state => ({
      totalBalance: state.totalBalance,
      showBalanceLoadingWithoutLocal: state.showBalanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal: state.showChangeLoadingWithoutLocal,
      isAnyRemoteRefreshing: state.isAnyRemoteRefreshing,
      isChangeAnyLoading: state.isChangeAnyLoading,
      changeData: state.changeData,
    })),
  );
  const data = changeData;
  const scene24hLoading = isChangeAnyLoading;

  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { remoteVersion } = useUpgradeInfo();

  const [hideType, setHideType] = useHideBalance();
  const handleHideTypeChange = useMemoizedFn((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (hideType === 'HALF_HIDE') {
      setHideType('HIDE');
    } else if (hideType === 'HIDE') {
      setHideType('SHOW');
    } else {
      setHideType('HALF_HIDE');
    }
  });
  const { currency } = useCurrency();
  const tokenDisplayMode = useTokenList(s => s.tokenDisplayMode);
  const setTokenDisplayMode = useTokenList(s => s.setTokenDisplayMode);

  const showRightArea = useMemo(() => {
    return focusedTab !== HomeTabName.token;
  }, [focusedTab]);

  const InOverViewTab = useMemo(() => {
    return focusedTab === HomeTabName.overview;
  }, [focusedTab]);

  const tokenDisplayModeLabel = useMemo(() => {
    if (tokenDisplayMode === 'bySymbol') {
      return 'By Symbol';
    }
    if (tokenDisplayMode === 'byAsset') {
      return 'By Asset';
    }
    return 'By Address';
  }, [tokenDisplayMode]);
  useReportTokenTabView({
    focusedTab,
    tokenDisplayModeLabel,
  });
  const handleToggleTokenDisplayMode = useCallback(() => {
    if (tokenDisplayMode === 'byAddress') {
      setTokenDisplayMode('byAsset');
    } else if (tokenDisplayMode === 'byAsset') {
      setTokenDisplayMode('bySymbol');
    } else {
      setTokenDisplayMode('byAddress');
    }
  }, [setTokenDisplayMode, tokenDisplayMode]);

  const netWorth = useMemo(() => {
    return formatSmallCurrencyValueParts(totalBalance, { currency }).text;
  }, [currency, totalBalance]);
  const netWorthValue = useSharedValue(netWorth);
  useEffect(() => {
    netWorthValue.value = netWorth;
  }, [netWorth, netWorthValue]);
  const changePercent = useMemo(() => {
    if (!data.changePercent) {
      return '';
    }
    return `${data.isLoss ? '-' : '+'}${data.changePercent}`;
  }, [data.changePercent, data.isLoss]);
  const showChangeLoading = showChangeLoadingWithoutLocal;
  const showHeaderSideLoadingIndicator = useMemo(() => {
    return showBalanceLoadingWithoutLocal || isAnyRemoteRefreshing;
  }, [isAnyRemoteRefreshing, showBalanceLoadingWithoutLocal]);

  const gasketWebViewRef = useRef<LocalWebView>(null);

  const previousLoading = usePrevious(scene24hLoading);
  useEffect(() => {
    if (data.isLoss) {
      return;
    }
    if (!scene24hLoading && previousLoading) {
      gasketWebViewRef.current?.sendMessage?.({
        type: 'GASKETVIEW:TOGGLE_LOADING',
        info: {
          loading: previousLoading,
        },
      });
    }
  }, [data.isLoss, previousLoading, scene24hLoading]);

  const { opacityStyle, pullPercent } = useHomeDrawerOpacityStyle();

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      pullPercent.value,
      [0, -100],
      [HOME_TOP_HEADER_SIZES.topHeaderHeight, 0],
      Extrapolate.CLAMP,
    ),
  }));
  const totalBalanceStyle = useAnimatedStyle(() => {
    const netWorthProgress = interpolate(
      apisHomeTabIndex.svTabIndexDecimal.value,
      [0.62, 0.82],
      [0, 1],
      Extrapolate.CLAMP,
    );

    return {
      opacity: 1 - netWorthProgress,
    };
  });
  const netWorthStyle = useAnimatedStyle(() => {
    const netWorthProgress = interpolate(
      apisHomeTabIndex.svTabIndexDecimal.value,
      [0.62, 0.82],
      [0, 1],
      Extrapolate.CLAMP,
    );

    return {
      opacity: netWorthProgress,
    };
  });

  return (
    <Animated.View style={[styles.headerBox, opacityStyle, headerStyle]}>
      <View style={styles.leftBox}>
        <Animated.View
          pointerEvents={focusedTab === HomeTabName.overview ? 'auto' : 'none'}
          style={[styles.leftContent, totalBalanceStyle]}>
          <Text style={styles.balanceTextBox}>
            {t('page.nextComponent.multiAddressHome.totalBalance')}
          </Text>
          <TouchableOpacity
            style={[IS_ANDROID && { top: 2 }]}
            onPress={handleHideTypeChange}>
            {hideType === 'HALF_HIDE' ? (
              <RcIconEyeHalfCloseCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            ) : hideType === 'HIDE' ? (
              <RcIconEyeCloseCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            ) : (
              <RcIconEyeCC
                color={colors2024['neutral-title-1']}
                width={20}
                height={20}
              />
            )}
          </TouchableOpacity>
          {!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
          showHeaderSideLoadingIndicator ? (
            <LoadingCircle />
          ) : null}
        </Animated.View>
        <Animated.View
          pointerEvents={focusedTab === HomeTabName.overview ? 'none' : 'auto'}
          style={[styles.leftContent, netWorthStyle]}>
          <Pressable
            style={styles.netWorthPressable}
            onPress={() => handleSwitchToTokenTab(0)}>
            {showBalanceLoadingWithoutLocal ? (
              <View style={styles.balanceLoadingBox}>
                <LoadingCircle />
              </View>
            ) : (
              <AnimatedTickerText
                value={netWorthValue}
                maxLength={16}
                lineHeight={22}
                duration={320}
                style={styles.balanceTextBox}
                fontSizeByLength={{
                  maxFontSize: 18,
                  minFontSize: 18,
                  threshold: 16,
                }}
              />
            )}
            {!showBalanceLoadingWithoutLocal && changePercent ? (
              <Text
                style={[
                  styles.changePercentText,
                  {
                    color: data.isLoss
                      ? colors2024['red-default']
                      : colors2024['green-default'],
                  },
                ]}>
                {changePercent}
              </Text>
            ) : null}
            {showChangeLoading ? (
              <View style={styles.changeLoadingBox}>
                <LoadingCircle />
              </View>
            ) : null}
            {!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            showHeaderSideLoadingIndicator ? (
              <LoadingCircle />
            ) : null}
          </Pressable>
        </Animated.View>
      </View>

      <Pressable
        style={styles.rightArea}
        onPress={() => handleSwitchToTokenTab(1)}>
        {showRightArea ? (
          <>
            <FeedbackEntryOnHeader style={styles.feedbackEntry} />

            <AddressListScreenButton type="address" />
            <Pressable
              style={styles.settingEntry}
              {...makeTestIDProps(E2E_ID.home.settingsButton)}
              onPress={event => {
                event?.stopPropagation?.();
                navigation.navigateDeprecated(RootNames.StackSettings, {
                  screen: RootNames.Settings,
                  params: {},
                });

                matomoRequestEvent({
                  category: 'Click_Header',
                  action: 'Click_Setting',
                });
              }}>
              <View style={styles.headerTouchableIcon}>
                <RcIconSetting
                  width={20}
                  height={20}
                  color={colors2024['neutral-title-1']}
                />
                {remoteVersion.couldUpgrade && <View style={styles.redDot} />}
              </View>
            </Pressable>
            {!InOverViewTab && (
              <MultiHeaderRightHistory style={styles.pendingHistoryBox} />
            )}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={handleToggleTokenDisplayMode}>
              <View style={styles.displayModeButton}>
                <Text style={styles.displayModeText}>
                  {tokenDisplayModeLabel}
                </Text>
                <IconPerpEdit color={colors2024['neutral-body']} />
              </View>
            </TouchableOpacity>
            <MultiHeaderRightHistory
              style={styles.pendingHistoryBoxInOverview}
            />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerBox: {
    // ...makeDebugBorder(),
    // ...makeDevOnlyStyle({
    //   backgroundColor: colors2024['orange-light-1'],
    // }),
    height: HOME_TOP_HEADER_SIZES.topHeaderHeight,
    // height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    position: 'relative',
  },
  leftBox: {
    height: '100%',
    flex: 1,
    position: 'relative',
  },
  leftContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  netWorthPressable: {
    height: '100%',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  balanceTextBox: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  balanceLoadingBox: {
    minWidth: 24,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePercentText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  changeLoadingBox: {
    minWidth: 20,
    minHeight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightArea: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flex: 1,
    // position: 'relative',
    // ...makeDebugBorder(),
  },
  displayModeButton: {
    height: HeaderHeight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-5'],
    // justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  displayModeText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-body'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    // position: 'relative',
    // ...makeDebugBorder(),
  },
  headerTouchableIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  feedbackEntry: {
    height: '100%',
    paddingRight: 6,
    // ...makeDebugBorder('yellow'),
  },
  settingEntry: {
    // marginRight: -ITEM_LAYOUT_PADDING_HORIZONTAL,
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 0,
    position: 'relative',
    // ...makeDebugBorder(),
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['red-default'],
    position: 'absolute',
    top: 0,
    right: -3,
  },
  pendingHistoryBox: {
    marginLeft: 16,
  },
  pendingHistoryBoxInOverview: {
    marginLeft: 12,
  },
}));
