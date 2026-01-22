import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import RcIconLoading from '@/assets2024/icons/home/Iconloading.svg';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

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
} from '@/constant/home';
import { useMemoizedFn } from 'ahooks';
import { useHideBalance } from '../hooks/useHideBalance';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { AddressListScreenButton } from '@/screens/Address/AddressListScreenButton';
import { formatSmallCurrencyValue } from '@/hooks/useCurve';
import { useCurrency } from '@/hooks/useCurrency';
import { useLoadAssets } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useHomeTabIndex } from '@/hooks/navigation';
import {
  useScene24hBalanceCombinedData,
  useSceneIsLoading,
} from '@/hooks/useScene24hBalance';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import balanceStore from '@/store/balance';
import { useHomeDrawerOpacityStyle } from '../hooks/useHomeDrawerAnimate';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { IS_ANDROID } from '@/core/native/utils';

export function TabsTopHeader({
  indexDecimalValue,
}: // indexValue,
{
  indexDecimalValue: SharedValue<number>;
  // indexValue: SharedValue<number>;
}): JSX.Element {
  const tabIndexFromSv = useValueFromSharedValue(indexDecimalValue);
  const showNetWorth = tabIndexFromSv > 0.7;

  const { isLoading: loading } = useSceneIsLoading('Home');
  const { combinedData: data } = useScene24hBalanceCombinedData('Home');

  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { remoteVersion } = useUpgradeInfo();

  const [hideType, setHideType] = useHideBalance();
  const handleHideTypeChange = useMemoizedFn(() => {
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
  const totalBalance = useMemo(() => {
    if (!myTop10Addresses.length) {
      return 0;
    }
    return myTop10Addresses.reduce((acc, address) => {
      const balance = balanceMap[address.toLowerCase()];
      return acc + (balance?.totalBalance || 0);
    }, 0);
  }, [balanceMap, myTop10Addresses]);

  const { refreshing } = useLoadAssets();

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

  const { opacityStyle } = useHomeDrawerOpacityStyle();

  return (
    <Animated.View style={[styles.headerBox, opacityStyle]}>
      {showNetWorth ? (
        <View style={styles.leftBox}>
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
          {refreshing ? <LoadingCircle /> : null}
        </View>
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
          {loading ? <LoadingCircle /> : null}
        </View>
      )}

      <View style={styles.rightArea}>
        <FeedbackEntryOnHeader style={styles.feedbackEntry} />

        <AddressListScreenButton type="address" />
        <TouchableWithoutFeedback
          style={styles.settingEntry}
          onPress={() => {
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
        </TouchableWithoutFeedback>
      </View>
    </Animated.View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerBox: {
    // ...makeDebugBorder(),
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -ITEM_LAYOUT_PADDING_HORIZONTAL,
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
    paddingRight: ITEM_LAYOUT_PADDING_HORIZONTAL,
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
