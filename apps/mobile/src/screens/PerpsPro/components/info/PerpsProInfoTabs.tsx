import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
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
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';
import { getPerpsProFontStyle } from '../common/perpsProVisual';
import { PERPS_PRO_INFO_TABS_HEIGHT } from './perpsProInfoTabsSticky';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

interface PerpsProInfoTabsProps {
  activeTab: PerpsProInfoTab;
  historyEnabled: boolean;
  indicatorPosition: SharedValue<number>;
  openOrdersCount: number;
  onHistoryPress: (hasPendingFunding: boolean) => void;
  pendingFundingCount: number;
  positionsCount: number;
  onChange: (tab: PerpsProInfoTab) => void;
}

const INFO_TAB_INACTIVE_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '500');
const INFO_TAB_ACTIVE_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '700');

const PerpsProInfoTabLabel: React.FC<{
  activeColor: string;
  index: number;
  inactiveColor: string;
  label: string;
  position: SharedValue<number>;
  style: StyleProp<TextStyle>;
  testID: string;
}> = ({
  activeColor,
  index,
  inactiveColor,
  label,
  position,
  style,
  testID,
}) => {
  const activeAnimatedStyle = useAnimatedStyle(() => {
    const maximumIndex = PERPS_PRO_INFO_TABS.length - 1;
    const rawPosition = Number.isFinite(position.value) ? position.value : 0;
    const visualIndex = Math.round(
      Math.max(0, Math.min(maximumIndex, rawPosition)),
    );
    return {
      opacity: visualIndex === index ? 1 : 0,
    };
  }, [position, index]);
  const inactiveAnimatedStyle = useAnimatedStyle(() => {
    const maximumIndex = PERPS_PRO_INFO_TABS.length - 1;
    const rawPosition = Number.isFinite(position.value) ? position.value : 0;
    const visualIndex = Math.round(
      Math.max(0, Math.min(maximumIndex, rawPosition)),
    );
    return {
      opacity: visualIndex === index ? 0 : 1,
    };
  }, [position, index]);

  return (
    <View style={labelStyles.container}>
      {/* Fixed font layers avoid a text layout update at the swipe midpoint. */}
      <Reanimated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        numberOfLines={1}
        style={[
          style,
          INFO_TAB_ACTIVE_FONT_STYLE,
          { color: activeColor },
          activeAnimatedStyle,
        ]}
        testID={`${testID}-active`}>
        {label}
      </Reanimated.Text>
      <Reanimated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        numberOfLines={1}
        style={[
          style,
          INFO_TAB_INACTIVE_FONT_STYLE,
          { color: inactiveColor },
          labelStyles.visibleText,
          inactiveAnimatedStyle,
        ]}
        testID={`${testID}-inactive`}>
        {label}
      </Reanimated.Text>
    </View>
  );
};

const labelStyles = {
  container: {
    position: 'relative' as const,
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
    historyEnabled,
    indicatorPosition,
    onChange,
    onHistoryPress,
    openOrdersCount,
    pendingFundingCount,
    positionsCount,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [tabFrames, setTabFrames] = React.useState<
      Partial<Record<PerpsProInfoTab, PerpsProTabIndicatorLayout>>
    >({});
    const tabFramesRef = React.useRef(tabFrames);

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
        commitTabFrame(tab, { width, x });
      },
      [commitTabFrame],
    );
    const indicatorLayouts = React.useMemo(() => {
      const layouts: PerpsProTabIndicatorLayout[] = [];
      for (const tab of PERPS_PRO_INFO_TABS) {
        const frame = tabFrames[tab];
        if (!frame || frame.width <= 0) {
          return [];
        }
        // Figma's round stroke caps extend 1.5px beyond each text edge.
        layouts.push({ x: frame.x - 1.5, width: frame.width + 3 });
      }
      return layouts;
    }, [tabFrames]);

    const labels: Record<PerpsProInfoTab, string> = {
      account: t('page.perps.pro.account.account'),
      positions: `${t('page.perps.pro.account.positions')} ${positionsCount}`,
      openOrders: `${t(
        'page.perps.pro.account.openOrders',
      )} ${openOrdersCount}`,
    };

    return (
      <View accessibilityRole="tablist" style={styles.container}>
        {PERPS_PRO_INFO_TABS.map((tab, index) => {
          const selected = tab === activeTab;
          return (
            <Pressable
              accessibilityLabel={labels[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onLayout={event => recordTabFrame(tab, event)}
              onPress={() => onChange(tab)}
              style={styles.tab}
              testID={`perps-pro-info-tab-${tab}`}>
              <PerpsProInfoTabLabel
                activeColor={colors2024['neutral-title-1']}
                inactiveColor={colors2024['neutral-secondary']}
                index={index}
                label={labels[tab]}
                position={indicatorPosition}
                style={styles.text}
                testID={`perps-pro-info-tab-label-${tab}`}
              />
            </Pressable>
          );
        })}
        <PerpsProTabIndicator
          geometryMode="transform"
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
    gap: 16,
    height: PERPS_PRO_INFO_TABS_HEIGHT,
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    height: '100%',
    paddingTop: 8,
    position: 'relative',
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['neutral-body'],
    borderRadius: 1.5,
    bottom: -0.5,
    height: 3,
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
    ...PERPS_PRO_NUMBER_STYLE,
    width: '100%',
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    position: 'absolute',
    textAlign: 'center',
  },
}));
