import React from 'react';
import { InteractionManager } from 'react-native';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { perfEvents } from '@/core/utils/perf';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { NFTList } from './NFTList';
import { ProtocolList } from './ProtocolList';
import { TokenList } from './TokenList';
import { HomeOverview } from '@/screens/Home/components/HomeOverview';
import { HomeSceneContainer } from '@/screens/Home/components/scene/HomeSceneContainer';

interface TabMultiAssetsProps {
  chromeBackdrop?: React.ReactNode;
}

export { HomeTabName as TabName } from '@/hooks/navigation';

const homeTabScrollerRef = apisHomeTabIndex.homeTabScrollerRef;
type ReadableAccountStoreWarmupTarget = 'token' | 'nft' | 'protocol';
const scheduledReadableAccountStoreWarmupTargets =
  new Set<ReadableAccountStoreWarmupTarget>();

runStartupTask(() => {
  perfEvents.subscribe('NAV_BACK_ON_HOME', () => {
    if (!homeTabScrollerRef.current) {
      return;
    }
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex() || 0;
    if (currentIndex > 0) {
      homeTabScrollerRef.current?.setIndex(Math.max(0, currentIndex - 1));
    }
  });
}, STARTUP_TASKS.homeTabBackListener);

function getReadableAccountStoreWarmupTargetByIndex(
  idx: number,
): ReadableAccountStoreWarmupTarget | null {
  if (idx === 1) {
    return 'token';
  }
  if (idx === 2) {
    return 'protocol';
  }
  if (idx === 3) {
    return 'nft';
  }
  return null;
}

function scheduleReadableAccountStoreWarmupForTab(idx: number) {
  const target = getReadableAccountStoreWarmupTargetByIndex(idx);
  if (!target || scheduledReadableAccountStoreWarmupTargets.has(target)) {
    return;
  }

  scheduledReadableAccountStoreWarmupTargets.add(target);
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      import('@/setup-app-before-render')
        .then(({ startInitReadableAccountStores }) =>
          startInitReadableAccountStores(target, `home_tab_${target}`),
        )
        .catch(error => {
          scheduledReadableAccountStoreWarmupTargets.delete(target);
          console.error(
            `scheduleReadableAccountStoreWarmupForTab::${target}::error`,
            error,
          );
        });
    }, 80);
  });
}

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = ({
  chromeBackdrop,
}) => {
  useRendererDetect({ name: 'TabsMultiAssets' });

  const pages = React.useMemo(
    () => ({
      [HomeTabName.overview]: <HomeOverview />,
      [HomeTabName.token]: <TokenList />,
      [HomeTabName.defi]: <ProtocolList />,
      [HomeTabName.nft]: <NFTList />,
    }),
    [],
  );

  return (
    <HomeSceneContainer
      chromeBackdrop={chromeBackdrop}
      header={<TabsTopHeader />}
      onTabSelected={scheduleReadableAccountStoreWarmupForTab}
      pages={pages}
      tabBar={<HomeCustomMaterialTabBar />}
    />
  );
};
