import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  Animated as RNAnimated,
  Easing as RNEasing,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import RcIconLoading from '@/assets2024/icons/home/Iconloading.svg';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';

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
  SHOULD_SHOW_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { useMemoizedFn } from 'ahooks';
import { useHideBalance } from '../hooks/useHideBalance';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { AddressListScreenButton } from '@/screens/Address/AddressListScreenButton';
import { formatSmallCurrencyValue } from '@/hooks/useCurve';
import { useCurrency } from '@/hooks/useCurrency';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import { useFocusedTab } from 'react-native-collapsible-tab-view';
import Animated, { SharedValue } from 'react-native-reanimated';
import { apisHomeTabIndex, useHomeTabIndex } from '@/hooks/navigation';
import {
  useScene24hBalanceCombinedData,
  useSceneIsLoading,
} from '@/hooks/useScene24hBalance';
import useTokenList from '@/store/tokens';
import IconPerpEdit from '@/assets2024/icons/perps/icon-switch-mode.svg';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import balanceStore from '@/store/balance';
import { useHomeDrawerOpacityStyle } from '../hooks/useHomeDrawerAnimate';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { IS_ANDROID } from '@/core/native/utils';
import { TabName } from '@/screens/Address/components/MultiAssets/TabsMultiAssets';

const HeaderHeight = 30;
const handleSwitchToTokenTab = (index: number) => {
  apisHomeTabIndex.setTabIndex(index, true);
};

export function TabsTopHeader({
  indexDecimalValue,
}: // indexValue,
{
  indexDecimalValue: SharedValue<number>;
  // indexValue: SharedValue<number>;
}): JSX.Element {
  const tabIndexFromSv = useValueFromSharedValue(indexDecimalValue);
  const showNetWorth = tabIndexFromSv > 0.7;
  // const { tabIndex, setTabIndex } = useHomeTabIndex();
  const { isLoading: loading } = useSceneIsLoading('Home');
  const { combinedData: data } = useScene24hBalanceCombinedData('Home');

  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { remoteVersion } = useUpgradeInfo();
  const focusedTab = useFocusedTab();

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
  const { myTop10Addresses } = useAccountInfo();
  const balanceMap = balanceStore(s => s.balanceMap);
  const isTop10BalanceLoading = balanceStore(s => {
    return s.getIsTop10BalanceLoading(myTop10Addresses, s.isLoadingByAddress)
      .isTop10BalanceLoading;
  });

  const totalBalance = useMemo(() => {
    if (!myTop10Addresses.length) {
      return 0;
    }
    return myTop10Addresses.reduce((acc, address) => {
      const balance = balanceMap[address.toLowerCase()];
      return acc + (balance?.totalBalance || 0);
    }, 0);
  }, [balanceMap, myTop10Addresses]);

  const tokenDisplayMode = useTokenList(s => s.tokenDisplayMode);
  const setTokenDisplayMode = useTokenList(s => s.setTokenDisplayMode);

  const showRightArea = useMemo(() => {
    return focusedTab !== TabName.token;
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
    return formatSmallCurrencyValue(totalBalance, { currency });
  }, [currency, totalBalance]);
  const changePercent = useMemo(() => {
    return `${data.isLoss ? '-' : '+'}${data.changePercent}`;
  }, [data.changePercent, data.isLoss]);

  const gasketWebViewRef = useRef<LocalWebView>(null);

  const previousLoading = usePrevious(loading);
  useEffect(() => {
    if (data.isLoss) {
      return;
    }
    if (!loading && previousLoading) {
      gasketWebViewRef.current?.sendMessage?.({
        type: 'GASKETVIEW:TOGGLE_LOADING',
        info: {
          loading: previousLoading,
        },
      });
    }
  }, [data.isLoss, loading, previousLoading]);

  const { opacityStyle, pullPercent } = useHomeDrawerOpacityStyle();

  // const headerStyle = useAnimatedStyle(() => ({
  //   transform: [
  //     {
  //     translateY: interpolate(
  //       pullPercent.value,
  //       [-THRESHOLD_PERCENT, 0],
  //       [-HOME_TOP_HEADER_SIZES.scrollableListTopOffset, 1],
  //       Extrapolation.CLAMP,
  //     ),
  //     },
  //   ]
  // }));

  return (
    <Animated.View style={[styles.headerBox, opacityStyle]}>
      {showNetWorth ? (
        <Pressable
          style={styles.leftBox}
          onPress={() => handleSwitchToTokenTab(0)}>
          <Text style={styles.balanceTextBox}>{netWorth}</Text>
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
          {isTop10BalanceLoading ? <LoadingCircle /> : null}
        </Pressable>
      ) : (
        <View style={styles.leftBox}>
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
          {!SHOULD_SHOW_INDICATOR_WHEN_LOADING && isTop10BalanceLoading ? (
            <LoadingCircle />
          ) : null}
        </View>
      )}

      <Pressable
        style={styles.rightArea}
        onPress={() => handleSwitchToTokenTab(1)}>
        {showRightArea ? (
          <>
            <FeedbackEntryOnHeader style={styles.feedbackEntry} />

            <AddressListScreenButton type="address" />
            <Pressable
              style={styles.settingEntry}
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
          </>
        ) : (
          <TouchableOpacity onPress={handleToggleTokenDisplayMode}>
            <View style={styles.displayModeButton}>
              <Text style={styles.displayModeText}>
                {tokenDisplayModeLabel}
              </Text>
              <IconPerpEdit color={colors2024['neutral-body']} />
            </View>
          </TouchableOpacity>
        )}
      </Pressable>
    </Animated.View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerBox: {
    // ...makeDebugBorder(),
    // ...makeDevOnlyStyle({
    //   opacity: 0.5
    // }),
    height: HOME_TOP_HEADER_SIZES.headerHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    position: 'relative',
  },
  leftBox: {
    // ...makeDebugBorder('yellow'),
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    display: 'flex',
  },
  balanceTextBox: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
    // ...makeDebugBorder('green'),
  },
  changePercentText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
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
}));
