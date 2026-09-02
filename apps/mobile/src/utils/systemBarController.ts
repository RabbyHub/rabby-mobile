import { AppState } from 'react-native';
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
let reapplyTimer: ReturnType<typeof setTimeout> | null = null;

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

export function reapplyAppSystemBars() {
  if (!appSystemBarsEntry) {
    return;
  }

  SystemBars.reapply();
}

function scheduleAppSystemBarsReapply() {
  if (reapplyTimer != null) {
    clearTimeout(reapplyTimer);
  }

  // Wait until the native focus/active event has finished before reapplying.
  reapplyTimer = setTimeout(() => {
    reapplyTimer = null;
    reapplyAppSystemBars();
  }, 0);
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

AppState.addEventListener('change', nextAppState => {
  if (nextAppState === 'active') {
    scheduleAppSystemBarsReapply();
  }
});

// Android emits focus after onWindowFocusChanged. This runs after native code
// has restored the window and avoids relying on a React render to reapply it.
AppState.addEventListener('focus', scheduleAppSystemBarsReapply);
