import { SystemBars } from 'react-native-edge-to-edge';
import type {
  SystemBarsEntry,
  SystemBarsProps,
} from 'react-native-edge-to-edge';

import type { AppRootName, ScreenSystemBarConfig } from '@/constant/layout';
import { getScreenSystemBarConfig } from '@/constant/layout';
import { getBinaryMode } from '@/hooks/theme';
import { perfEvents } from '@/core/utils/perf';

let appSystemBarsEntry: SystemBarsEntry | null = null;

function toEdgeToEdgeStyle(
  statusBarStyle: ScreenSystemBarConfig['statusBarStyle'],
) {
  return statusBarStyle === 'dark-content' ? 'dark' : 'light';
}

export function syncAppSystemBars(config: ScreenSystemBarConfig) {
  const props: SystemBarsProps = {
    style: toEdgeToEdgeStyle(config.statusBarStyle),
  };

  appSystemBarsEntry = appSystemBarsEntry
    ? SystemBars.replaceStackEntry(appSystemBarsEntry, props)
    : SystemBars.pushStackEntry(props);
}

export function syncAppSystemBarsForRoute({
  screenName,
  isDarkTheme,
  isShowingDappCard,
}: {
  screenName: string | AppRootName;
  isDarkTheme: boolean;
  isShowingDappCard?: boolean;
}) {
  syncAppSystemBars(
    getScreenSystemBarConfig({
      screenName,
      isDarkTheme,
      isShowingDappCard,
    }),
  );
}

perfEvents.addListener('EVENT_ROUTE_CHANGE', ({ currentRouteName }) => {
  if (!currentRouteName) {
    return;
  }

  syncAppSystemBarsForRoute({
    screenName: currentRouteName,
    isDarkTheme: getBinaryMode() === 'dark',
  });
});
