import RcIconHistory from '@/assets2024/icons/perps/IconHistoryCC.svg';
import RcIconPending from '@/assets2024/icons/home/pending.svg';
import { Text } from '@/components/Typography';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text as NativeText,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';
import { PERPS_PRO_INFO_TABS_HEIGHT } from './perpsProInfoTabsSticky';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

interface PerpsProInfoTabsProps {
  activeTab: PerpsProInfoTab;
  highlightedTabPosition?: SharedValue<number>;
  historyEnabled: boolean;
  indicatorPosition: SharedValue<number>;
  indicatorTransitionActive?: SharedValue<boolean>;
  openOrdersCount: number;
  onHistoryPress: (hasPendingFunding: boolean) => void;
  pendingFundingCount: number;
  positionsCount: number;
  onChange: (tab: PerpsProInfoTab) => void;
}

const PerpsProInfoTabLabel: React.FC<{
  activeColor: string;
  highlightedTabPosition: SharedValue<number>;
  index: number;
  inactiveColor: string;
  label: string;
  style: StyleProp<TextStyle>;
}> = ({
  activeColor,
  highlightedTabPosition,
  index,
  inactiveColor,
  label,
  style,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const active = Math.abs(highlightedTabPosition.value - index) < 0.5;
    return {
      color: active ? activeColor : inactiveColor,
      fontWeight: active ? '500' : '400',
    };
  }, [activeColor, highlightedTabPosition, inactiveColor, index]);

  return (
    <View style={labelStyles.container}>
      <NativeText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        numberOfLines={1}
        style={[style, labelStyles.measureText]}>
        {label}
      </NativeText>
      <Reanimated.Text
        numberOfLines={1}
        style={[style, labelStyles.visibleText, animatedStyle]}>
        {label}
      </Reanimated.Text>
    </View>
  );
};

const labelStyles = {
  container: {
    position: 'relative' as const,
  },
  measureText: {
    fontWeight: '500' as const,
    opacity: 0,
  },
  visibleText: {
    left: 0,
    position: 'absolute' as const,
    right: 0,
    textAlign: 'center' as const,
    top: 0,
  },
};

const PerpsProPendingHistoryIcon: React.FC<{ count: number }> = ({ count }) => {
  const { styles } = useTheme2024({ getStyle });
  const rotation = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: 1600,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View style={styles.pendingIcon} testID="perps-pro-history-pending">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RcIconPending height={24} width={24} />
      </Animated.View>
      {count > 1 ? (
        <Text
          style={styles.pendingCount}
          testID="perps-pro-history-pending-count">
          {count}
        </Text>
      ) : null}
    </View>
  );
};

export const PerpsProInfoTabs: React.FC<PerpsProInfoTabsProps> = React.memo(
  ({
    activeTab,
    highlightedTabPosition: providedHighlightedTabPosition,
    historyEnabled,
    indicatorPosition,
    indicatorTransitionActive: providedIndicatorTransitionActive,
    onChange,
    onHistoryPress,
    openOrdersCount,
    pendingFundingCount,
    positionsCount,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const highlightedTabPosition =
      providedHighlightedTabPosition ?? indicatorPosition;
    const fallbackIndicatorTransitionActive = useSharedValue(false);
    const indicatorTransitionActive =
      providedIndicatorTransitionActive ?? fallbackIndicatorTransitionActive;
    const [tabFrames, setTabFrames] = React.useState<
      Partial<Record<PerpsProInfoTab, PerpsProTabIndicatorLayout>>
    >({});
    const tabFramesRef = React.useRef(tabFrames);
    const pendingTabFramesRef = React.useRef<
      Partial<Record<PerpsProInfoTab, PerpsProTabIndicatorLayout>>
    >({});

    const commitTabFrame = React.useCallback(
      (tab: PerpsProInfoTab, frame: PerpsProTabIndicatorLayout) => {
        const previous = tabFramesRef.current[tab];
        if (previous?.width === frame.width && previous.x === frame.x) {
          return;
        }
        const next = { ...tabFramesRef.current, [tab]: frame };
        tabFramesRef.current = next;
        setTabFrames(next);
      },
      [],
    );

    const recordTabFrame = React.useCallback(
      (tab: PerpsProInfoTab, event: LayoutChangeEvent) => {
        const { width, x } = event.nativeEvent.layout;
        const frame = { width, x };
        if (indicatorTransitionActive.value && tabFramesRef.current[tab]) {
          pendingTabFramesRef.current[tab] = frame;
          return;
        }
        commitTabFrame(tab, frame);
      },
      [commitTabFrame, indicatorTransitionActive],
    );
    const flushPendingTabFrames = React.useCallback(() => {
      if (indicatorTransitionActive.value) {
        return;
      }
      const pendingFrames = pendingTabFramesRef.current;
      if (Object.keys(pendingFrames).length === 0) {
        return;
      }
      pendingTabFramesRef.current = {};
      const next = { ...tabFramesRef.current, ...pendingFrames };
      tabFramesRef.current = next;
      setTabFrames(next);
    }, [indicatorTransitionActive]);
    useAnimatedReaction(
      () => indicatorTransitionActive.value,
      (active, previousActive) => {
        if (previousActive && !active) {
          runOnJS(flushPendingTabFrames)();
        }
      },
      [flushPendingTabFrames, indicatorTransitionActive],
    );
    const indicatorLayouts = React.useMemo(() => {
      const layouts: PerpsProTabIndicatorLayout[] = [];
      for (const tab of PERPS_PRO_INFO_TABS) {
        const frame = tabFrames[tab];
        if (!frame || frame.width <= 0) {
          return [];
        }
        layouts.push(frame);
      }
      return layouts;
    }, [tabFrames]);

    const labels: Record<PerpsProInfoTab, string> = {
      account: t('page.perps.pro.account.account'),
      positions: `${t('page.perps.pro.account.positions')} (${positionsCount})`,
      openOrders: `${t(
        'page.perps.pro.account.openOrders',
      )} (${openOrdersCount})`,
    };

    return (
      <View accessibilityRole="tablist" style={styles.container}>
        {PERPS_PRO_INFO_TABS.map((tab, index) => {
          const selected = tab === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onLayout={event => recordTabFrame(tab, event)}
              onPress={() => onChange(tab)}
              style={styles.tab}
              testID={`perps-pro-info-tab-${tab}`}>
              <PerpsProInfoTabLabel
                activeColor={colors2024['neutral-title-1']}
                highlightedTabPosition={highlightedTabPosition}
                inactiveColor={colors2024['neutral-secondary']}
                index={index}
                label={labels[tab]}
                style={styles.text}
              />
            </Pressable>
          );
        })}
        <PerpsProTabIndicator
          layouts={indicatorLayouts}
          position={indicatorPosition}
          style={styles.indicator}
          testID="perps-pro-info-tab-indicator"
        />
        <Pressable
          accessibilityLabel={t('page.perps.pro.account.history')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !historyEnabled }}
          disabled={!historyEnabled}
          onPress={() => onHistoryPress(pendingFundingCount > 0)}
          style={styles.history}
          testID="perps-pro-history">
          {historyEnabled && pendingFundingCount > 0 ? (
            <PerpsProPendingHistoryIcon count={pendingFundingCount} />
          ) : (
            <RcIconHistory
              color={
                historyEnabled
                  ? colors2024['neutral-title-1']
                  : colors2024['neutral-foot']
              }
              height={24}
              width={24}
            />
          )}
        </Pressable>
      </View>
    );
  },
);

PerpsProInfoTabs.displayName = 'PerpsProInfoTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: PERPS_PRO_INFO_TABS_HEIGHT,
    paddingHorizontal: 15,
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 2,
    position: 'relative',
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['neutral-title-1'],
    bottom: 0,
    height: 2,
  },
  history: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 24,
  },
  pendingIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 24,
  },
  pendingCount: {
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    position: 'absolute',
    textAlign: 'center',
  },
}));
