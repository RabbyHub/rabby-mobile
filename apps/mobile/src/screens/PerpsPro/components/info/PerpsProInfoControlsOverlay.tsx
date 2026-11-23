import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PerpsProOverlayScrollBridge } from '../common/PerpsProOverlayScrollBridge';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';
import {
  PERPS_PRO_OPEN_ORDERS_CONTROLS_HEIGHT,
  PERPS_PRO_POSITIONS_CONTROLS_HEIGHT,
} from './perpsProInfoTabsSticky';
import type { PerpsProInfoScrollBridgeController } from './usePerpsProInfoScrollBridge';

export const PERPS_PRO_INFO_CONTROLS_HEIGHTS: Record<PerpsProInfoTab, number> =
  {
    account: 0,
    openOrders: PERPS_PRO_OPEN_ORDERS_CONTROLS_HEIGHT,
    positions: PERPS_PRO_POSITIONS_CONTROLS_HEIGHT,
  };

const ControlsPanel: React.FC<{
  children: ReactNode;
  index: number;
  pagePosition: SharedValue<number>;
  scrollBridge: PerpsProInfoScrollBridgeController;
  tab: PerpsProInfoTab;
  width: SharedValue<number>;
}> = ({ children, index, pagePosition, scrollBridge, tab, width }) => {
  const { styles } = useTheme2024({ getStyle });
  const height = PERPS_PRO_INFO_CONTROLS_HEIGHTS[tab];
  // Each panel travels with its pager page, like the in-list rows it replaces.
  const slideStyle = useAnimatedStyle(() => ({
    opacity: width.value > 0 ? 1 : 0,
    transform: [{ translateX: (index - pagePosition.value) * width.value }],
  }));
  return (
    <Reanimated.View
      style={[styles.panel, { height }, slideStyle]}
      testID={`perps-pro-info-controls-${tab}`}>
      {Platform.OS === 'android' ? (
        children
      ) : (
        <PerpsProOverlayScrollBridge
          controller={scrollBridge}
          height={height}
          testID={`perps-pro-info-controls-scroll-bridge-${tab}`}>
          {children}
        </PerpsProOverlayScrollBridge>
      )}
    </Reanimated.View>
  );
};

/**
 * Info controls pinned directly below the tabs. The list keeps a spacer of
 * the same height, so the panels cover it until the tabs stick and then stay
 * with the tabs instead of scrolling away.
 */
export const PerpsProInfoControlsOverlay: React.FC<{
  pagePosition: SharedValue<number>;
  panels: Partial<Record<PerpsProInfoTab, ReactNode>>;
  scrollBridge: PerpsProInfoScrollBridgeController;
}> = ({ pagePosition, panels, scrollBridge }) => {
  const { styles } = useTheme2024({ getStyle });
  const width = useSharedValue(0);
  return (
    <View
      onLayout={event => {
        width.value = event.nativeEvent.layout.width;
      }}
      pointerEvents="box-none"
      style={styles.container}
      testID="perps-pro-info-controls-overlay">
      {PERPS_PRO_INFO_TABS.map((tab, index) =>
        panels[tab] ? (
          <ControlsPanel
            index={index}
            key={tab}
            pagePosition={pagePosition}
            scrollBridge={scrollBridge}
            tab={tab}
            width={width}>
            {panels[tab]}
          </ControlsPanel>
        ) : null,
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: Math.max(...Object.values(PERPS_PRO_INFO_CONTROLS_HEIGHTS)),
    width: '100%',
  },
  panel: {
    backgroundColor: colors2024['neutral-bg-1'],
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
}));
