import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { E2E_ID } from '@/constant/e2e';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import { useUpgradeInfo } from '@/hooks/version';

import RcIconEyeCC from '@/assets2024/icons/home/eye-cc.svg';
import RcIconEyeCloseCC from '@/assets2024/icons/home/eye-close-cc.svg';
import { FeedbackHistoryHeaderEntry } from '@/components/Screenshot/FeedbackHistory/HeaderEntry';
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
  clamp,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { apisHomeTabIndex } from '@/hooks/navigation';
import IconPerpEdit from '@/assets2024/icons/perps/icon-switch-mode.svg';
import useTokenList from '@/store/tokens';
import { useHomeDrawerOpacityStyle } from '../hooks/useHomeDrawerAnimate';
import { IS_ANDROID } from '@/core/native/utils';
import { Text } from '@/components/Typography';
import { makeTestIDProps, type E2ETestID } from '@/utils/makeTestIDProps';
import { useShallow } from 'zustand/react/shallow';
import { MultiHeaderRightHistory } from '../MultiHeaderRightHistory';
import RefreshNudgedTickerText from '@/components/Animated/RefreshNudgedTickerText';
import {
  isHomeProjectionWaitingForValue,
  useHome24hProjection,
  useHomeBalanceProjection,
  useHomeRefreshProjection,
} from '@/store/homePortfolio';

const EMPTY_CHANGE_DATA = {
  rawChange: 0,
  changePercent: '',
  isLoss: false,
};

const BALANCE_TICKER_FONT_SIZE = {
  maxFontSize: 18,
  minFontSize: 18,
  threshold: 16,
} satisfies NonNullable<
  React.ComponentProps<typeof RefreshNudgedTickerText>['fontSizeByLength']
>;

const HeaderHeight = 30;
const handleSwitchToTokenTab = (index: number) => {
  apisHomeTabIndex.setTabIndex(index, true);
};

/**
 * The header has three right-hand forms, one per landing tab:
 * 0 = overview (feedback + address + settings)
 * 1 = token (display-mode pill + history)
 * 2 = defi / nft (address + settings + history)
 *
 * Each form crossfades inside a band centred on the 0.5-page mark where the
 * pager decides which page wins, so the chrome turns with the finger instead
 * of waiting for the settle commit. Adjacent forms always sum to 1, so the
 * band never shows a blank or a double-exposed pair.
 */
const FORM_BAND = 0.24;
/** How far a form travels while it is fading in or out. */
const FORM_SLIDE = 6;
/**
 * Width the right-hand history/clock anchor occupies: its 20dp icon plus the
 * 16dp gap to the left-hand group. The left-hand forms are anchored this far
 * from the right edge, so the anchor is shared by every asset tab instead of
 * being re-laid-out (or re-mounted) whenever the left group changes.
 */
const ANCHOR_WIDTH = 36;

function smoothstep(t: number) {
  'worklet';
  return t * t * (3 - 2 * t);
}

function formOpacity(p: number, index: number) {
  'worklet';
  // defi and nft share one form: freeze the track at 2 so it never fades out.
  const q = clamp(p, 0, 2);
  const rise = smoothstep(
    clamp((q - (index - 0.5 - FORM_BAND / 2)) / FORM_BAND, 0, 1),
  );
  const fall = smoothstep(
    clamp((q - (index + 0.5 - FORM_BAND / 2)) / FORM_BAND, 0, 1),
  );
  // The eased flanks spend less time near 50/50, so the two forms never sit
  // half-and-half over each other for long.
  return rise * (1 - fall);
}

function formSlideY(p: number, index: number) {
  'worklet';
  // Zero whenever a form is settled. While the swap is in flight the form
  // drifts a few dp: one vertical direction per swipe direction, so swiping
  // right makes the incoming form come down from the top and the outgoing one
  // leave downwards, and swiping left is the mirror image.
  //
  // The overview form and the pinned history/clock anchor deliberately do not
  // use this: they share one slot on the overview boundary and must trade
  // places in-place, otherwise the gear and the clock slide past each other.
  const d = p - index;
  const away = 1 - formOpacity(p, index);
  return (d < 0 ? -1 : 1) * away * FORM_SLIDE;
}

export function TabsTopHeader(): JSX.Element {
  const { balanceAvailability, totalBalance } = useHomeBalanceProjection(
    useShallow(state => ({
      balanceAvailability: state.availability,
      totalBalance: state.value?.totalBalance || 0,
    })),
  );
  const { changeAvailability, changeData, changeActivity } =
    useHome24hProjection(
      useShallow(state => ({
        changeAvailability: state.availability,
        changeData: state.value || EMPTY_CHANGE_DATA,
        changeActivity: state.activity,
      })),
    );
  const isAnyRemoteRefreshing = useHomeRefreshProjection(
    state => state.isAnyRemoteRefreshing,
  );
  const showBalanceLoadingWithoutLocal =
    isHomeProjectionWaitingForValue(balanceAvailability);
  const showChangeLoadingWithoutLocal =
    isHomeProjectionWaitingForValue(changeAvailability);
  const isChangeAnyLoading = changeActivity.isActive;
  const data = changeData;
  const scene24hLoading = isChangeAnyLoading;

  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { remoteVersion } = useUpgradeInfo();

  const [hideType, setHideType] = useHideBalance();
  const handleHideTypeChange = useMemoizedFn(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation?.();
      setHideType(hideType === 'HIDE' ? 'SHOW' : 'HIDE');
    },
  );
  const { currency } = useCurrency();
  const tokenDisplayMode = useTokenList(s => s.tokenDisplayMode);
  const setTokenDisplayMode = useTokenList(s => s.setTokenDisplayMode);

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
    return formatSmallCurrencyValueParts(totalBalance, {
      currency,
      formatMillion: false,
      decimalOverMillion: 2,
    }).text;
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
  const showNetWorthSideLoadingIndicator =
    showHeaderSideLoadingIndicator &&
    !showBalanceLoadingWithoutLocal &&
    !showChangeLoading;

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

  // The header is a scene overlay now: it collapses with the shared scene
  // offset and only fades while the dapp drawer is pulled up.
  const { opacityStyle } = useHomeDrawerOpacityStyle();

  // Left side: total-balance label on the overview, live balance from the first
  // asset page on. Same band as the right-hand forms so both halves of the
  // header turn at the same moment.
  const totalBalanceStyle = useAnimatedStyle(() => {
    const opacity = formOpacity(apisHomeTabIndex.svTabIndexDecimal.value, 0);
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  const netWorthStyle = useAnimatedStyle(() => {
    const opacity =
      1 - formOpacity(apisHomeTabIndex.svTabIndexDecimal.value, 0);
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  const overviewFormStyle = useAnimatedStyle(() => {
    const p = apisHomeTabIndex.svTabIndexDecimal.value;
    const opacity = formOpacity(p, 0);
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  const tokenFormStyle = useAnimatedStyle(() => {
    const p = apisHomeTabIndex.svTabIndexDecimal.value;
    const opacity = formOpacity(p, 1);
    return {
      opacity,
      transform: [{ translateY: formSlideY(p, 1) }],
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  const assetsFormStyle = useAnimatedStyle(() => {
    const p = apisHomeTabIndex.svTabIndexDecimal.value;
    const opacity = formOpacity(p, 2);
    return {
      opacity,
      transform: [{ translateY: formSlideY(p, 2) }],
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  // The history/clock is the same element in the token, defi and nft forms, so
  // it is mounted once and only fades across the overview boundary. Moving
  // between asset tabs never touches it.
  const anchorStyle = useAnimatedStyle(() => {
    const p = apisHomeTabIndex.svTabIndexDecimal.value;
    const opacity = 1 - formOpacity(p, 0);
    // The gear and the clock trade places inside the same slot, so this is a
    // straight foreground/background swap: both fade in place and neither
    // travels. Any vertical offset here makes the handoff read as a jump, and
    // it fights the token form sliding in from above.
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });

  // The settings entry is part of two forms (overview and defi/nft), so it has
  // to exist twice. Keep the documented test id on the overview copy and give
  // the assets copy its own id instead of leaving two identical ids mounted.
  const renderSettingsEntry = (testID: E2ETestID) => (
    <Pressable
      style={styles.settingEntry}
      {...makeTestIDProps(testID)}
      onPress={event => {
        event?.stopPropagation?.();
        navigation.navigateDeprecated(RootNames.StackSettings, {
          screen: RootNames.Settings,
          params: {},
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
  );

  return (
    <Animated.View style={[styles.headerBox, opacityStyle]}>
      <View style={styles.leftBox}>
        <Animated.View style={[styles.leftContent, totalBalanceStyle]}>
          <Text style={styles.balanceTextBox}>
            {t('page.nextComponent.multiAddressHome.totalBalance')}
          </Text>
          <TouchableOpacity
            style={[IS_ANDROID && { top: 2 }]}
            onPress={handleHideTypeChange}>
            {hideType === 'HIDE' ? (
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
        <Animated.View style={[styles.leftContent, netWorthStyle]}>
          <Pressable
            style={styles.netWorthPressable}
            onPress={() => handleSwitchToTokenTab(0)}>
            {showBalanceLoadingWithoutLocal ? (
              <View style={styles.balanceLoadingBox}>
                <LoadingCircle />
              </View>
            ) : (
              <RefreshNudgedTickerText
                value={netWorthValue}
                maxLength={16}
                lineHeight={22}
                duration={320}
                style={styles.balanceTextBox}
                fontSizeByLength={BALANCE_TICKER_FONT_SIZE}
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
            showNetWorthSideLoadingIndicator ? (
              <LoadingCircle />
            ) : null}
          </Pressable>
        </Animated.View>
      </View>

      <Pressable
        style={styles.rightArea}
        onPress={event => {
          // RNGH header buttons do not stop RN responder bubbling. Only the
          // empty header area should switch tabs, never Add Wallet / Feedback.
          if (event.target !== event.currentTarget) {
            return;
          }
          // The finger owns the pager mid-swipe; never start a jump then.
          const position = apisHomeTabIndex.svTabIndexDecimal.value;
          if (position > 0.05 && position < 0.95) {
            return;
          }
          handleSwitchToTokenTab(1);
        }}>
        {/* All three forms stay mounted and only animate opacity/translate, so
            the form turns with the drag instead of waiting for the settle
            commit. Pointer events follow whichever form is more than half
            visible, so a faded-out form can never swallow a tap. */}
        <Animated.View style={[styles.rightAnchorSlot, anchorStyle]}>
          <MultiHeaderRightHistory />
        </Animated.View>
        <Animated.View style={[styles.rightFormSlot, overviewFormStyle]}>
          <FeedbackHistoryHeaderEntry style={styles.feedbackEntry} />
          <AddressListScreenButton type="address" />
          {renderSettingsEntry(E2E_ID.home.settingsButton)}
        </Animated.View>
        <Animated.View
          style={[
            styles.rightFormSlot,
            styles.rightFormSlotAnchored,
            tokenFormStyle,
          ]}>
          <TouchableOpacity onPress={handleToggleTokenDisplayMode}>
            <View style={styles.displayModeButton}>
              <Text style={styles.displayModeText}>
                {tokenDisplayModeLabel}
              </Text>
              <IconPerpEdit color={colors2024['neutral-body']} />
            </View>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={[
            styles.rightFormSlot,
            styles.rightFormSlotAnchored,
            assetsFormStyle,
          ]}>
          <AddressListScreenButton type="address" />
          {renderSettingsEntry(E2E_ID.home.settingsButtonAssets)}
        </Animated.View>
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
    // The forms are absolutely positioned inside this row, so the row has no
    // in-flow content of its own. Stretch it to the header's height instead of
    // letting it collapse: the forms then centre on the same line the single
    // row used to centre on.
    alignSelf: 'stretch',
    // position: 'relative',
    // ...makeDebugBorder(),
  },
  // Exactly the box the right-hand area already had: every form is laid out the
  // same way the single row was laid out before, so a settled form sits on the
  // original line. Only the swap in flight adds a small translate on top.
  rightFormSlot: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Asset-tab forms sit to the left of the pinned anchor instead of at the edge.
  rightFormSlotAnchored: {
    right: ANCHOR_WIDTH,
  },
  // One instance, pinned to the right edge for every asset tab.
  rightAnchorSlot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
    // `IconSetting.svg` is a 19x18 artwork letterboxed inside the 20dp box, so
    // its ink sits ~0.2dp above the frame centre. Nudge it down by half a
    // physical pixel so the gear and the symmetric 24x24 history glyph share a
    // single optical centre while they cross-fade in the same slot.
    transform: [{ translateY: 0.5 / PixelRatio.get() }],
  },
  feedbackEntry: {
    height: '100%',
    paddingRight: 12,
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
