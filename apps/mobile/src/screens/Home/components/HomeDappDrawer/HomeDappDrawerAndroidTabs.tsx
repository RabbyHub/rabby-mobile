import React from 'react';
import type { NativeGesture } from 'react-native-gesture-handler';
import type { TabBarProps } from '@rabby-wallet/react-native-collapsible-tab-view/src/types';
import {
  RabbyControlledPager,
  type RabbyControlledPagerTab,
} from '@rabby-wallet/react-native-collapsible-tab-view/src/RabbyControlledPager';

export type HomeDappDrawerAndroidTab<T extends string> =
  RabbyControlledPagerTab<T>;

export function HomeDappDrawerAndroidTabs<T extends string>({
  tabs,
  initialTabName,
  drawerScrollableGesture,
  renderTabBar,
  onTabChange,
  renderTabContent,
}: {
  tabs: readonly HomeDappDrawerAndroidTab<T>[];
  initialTabName?: T;
  drawerScrollableGesture: NativeGesture;
  renderTabBar?: (props: TabBarProps<T>) => React.ReactElement | null;
  onTabChange?: (tab: T) => void;
  renderTabContent: (tab: T) => React.ReactNode;
}) {
  return (
    <RabbyControlledPager
      tabs={tabs}
      initialTabName={initialTabName}
      simultaneousGesture={drawerScrollableGesture}
      renderTabBar={renderTabBar}
      onTabChange={onTabChange}
      renderTabContent={renderTabContent}
    />
  );
}
