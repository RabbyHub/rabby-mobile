import React from 'react';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  MemeScreen,
  WatchlistScreen,
} from '@/perfs/loadables/homeNonTabNavigatorScreens';

/**
 * Non-production host for screens that can only render inside a
 * `react-native-collapsible-tab-view` `Tabs.Container` (their `Tabs.FlatList`
 * calls `useTabNameContext`). `Meme` and `Watchlist` are registered normally
 * but reachable only through the Home tab shell, so direct deeplinks crash
 * without a host.
 *
 * Params: `{ screenId: 'Meme' | 'Watchlist', params?: object }`
 */
const HOSTED_SCREENS: Record<string, React.ComponentType<any>> = {
  Meme: MemeScreen,
  Watchlist: WatchlistScreen,
};

function DevTabsHost({
  route,
  navigation,
}: {
  route: { params?: { screenId?: string; params?: Record<string, unknown> } };
  navigation: unknown;
}) {
  const screenId = route.params?.screenId ?? 'Meme';
  const Screen = HOSTED_SCREENS[screenId];

  if (!Screen) {
    return null;
  }

  return (
    <Tabs.Container
      headerHeight={0}
      renderTabBar={() => null}
      containerStyle={{ flex: 1 }}>
      <Tabs.Tab name={screenId}>
        <Screen
          navigation={navigation as never}
          route={
            {
              key: `dev-tabs-host-${screenId}`,
              name: screenId,
              params: route.params?.params ?? {},
            } as never
          }
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
}

export default DevTabsHost;
