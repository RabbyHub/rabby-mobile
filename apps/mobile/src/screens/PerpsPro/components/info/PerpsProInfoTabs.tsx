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
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SharedValue } from 'react-native-reanimated';

import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';
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

    const recordTabFrame = React.useCallback(
      (tab: PerpsProInfoTab, event: LayoutChangeEvent) => {
        const { width, x } = event.nativeEvent.layout;
        setTabFrames(current => {
          const previous = current[tab];
          if (previous?.width === width && previous.x === x) {
            return current;
          }
          return { ...current, [tab]: { width, x } };
        });
      },
      [],
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
        {PERPS_PRO_INFO_TABS.map(tab => {
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
              <Text
                numberOfLines={1}
                style={selected ? styles.activeText : styles.text}>
                {labels[tab]}
              </Text>
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
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
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
