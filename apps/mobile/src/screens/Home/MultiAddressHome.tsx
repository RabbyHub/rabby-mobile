import { RootNames } from '@/constant/layout';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import { trackGasAccountActiveStatusOncePerDay } from '@/utils/gasAccountAnalytics';
import { autoLoginGasAccountIfNeeded } from '@/utils/autoLoginGasAccount';
import { createGetStyles2024 } from '@/utils/styles';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { AppState, View } from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import * as apisAccount from '@/core/apis/account';
import {
  browserServiceApi,
  getBrowserBookmarks,
} from '@/core/serviceApi/browser';
import {
  getPinnedTokenSnapshot,
  getPreferenceSnapshot,
  setPreference,
} from '@/core/serviceApi/preference';
import {
  resetHomeStartupReady,
  scheduleHomeStartupReady,
  traceHomeStartupReady,
  useHomePostStartupReady,
  useHomeStartupReady,
} from '@/core/utils/homeStartupReady';
import { apisHomeTabIndex, resetNavigationTo } from '@/hooks/navigation';
import { matomoRequestEvent } from '@/utils/analytics';
import { getReadyNavigationInstance } from '@/utils/navigation';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { HomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import { useTrack0331HomeActiveSnapshots } from '@/utils/analytics0331';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import dayjs from 'dayjs';
import { setIsFoldMultiChart } from '../Address/components/MultiAssets/RenderRow/CurveChart';
import { TabsMultiAssets } from '../Address/components/MultiAssets/TabsMultiAssets';
import { useInitDetectDBAssets } from '../Search/useAssets';
import { TmpHomeRefresher } from './components/TmpHomeRefresher';
import { useHomePortfolioStore } from './hooks/useHomePortfolioSummary';
import { storeApiAccounts } from '@/hooks/account';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { markHomeContentReady } from '@/core/utils/homeStartupMilestones';
import { useHomeChainInfoFocus } from './useChainInfo';

let hasStartedInitReadableAccountStoresIdleWarmup = false;
let hasStartedHomeSceneDerivedDataActivation = false;
const HOME_DB_STARTUP_CRITICAL_REASON = 'home_startup';

function cancelStartupTaskHandle(
  handle: ReturnType<typeof scheduleStartupTask> | undefined,
) {
  if (handle && typeof handle === 'object' && 'cancel' in handle) {
    const maybeCancelable = handle as { cancel?: unknown };
    if (typeof maybeCancelable.cancel === 'function') {
      maybeCancelable.cancel();
    }
  }
}

async function startInitReadableAccountStoresIdleWarmup() {
  if (hasStartedInitReadableAccountStoresIdleWarmup) {
    return;
  }

  const accounts = await storeApiAccounts.fetchAccounts();
  if (!accounts.length || hasStartedInitReadableAccountStoresIdleWarmup) {
    return;
  }

  hasStartedInitReadableAccountStoresIdleWarmup = true;
  try {
    const { startInitReadableAccountStores } = await import(
      '@/setup-app-before-render'
    );
    await startInitReadableAccountStores('all', 'home_idle_fallback');
  } catch (error) {
    hasStartedInitReadableAccountStoresIdleWarmup = false;
    throw error;
  }
}

async function startHomeSceneDerivedDataActivationWarmup() {
  if (hasStartedHomeSceneDerivedDataActivation) {
    return;
  }

  hasStartedHomeSceneDerivedDataActivation = true;
  try {
    const { startHomeSceneDerivedDataActivation } = await import(
      '@/store/homeSceneActivation'
    );
    await startHomeSceneDerivedDataActivation('home_post_startup_ready');
  } catch (error) {
    hasStartedHomeSceneDerivedDataActivation = false;
    throw error;
  }
}

const detectHasAccounts = async () => {
  const result = { redirectAction: null as Function | null };
  const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();

  if (!hasAccountsInKeyring) {
    result.redirectAction = () => {
      const navigation = getReadyNavigationInstance();
      navigation && resetNavigationTo(navigation, 'GetStarted');
    };
  }

  return result;
};

function startHomeDbLowPriorityHold() {
  let disposed = false;
  let isCriticalActive = false;
  let releaseHandle: ReturnType<typeof scheduleStartupTask> | undefined;
  let setCriticalMode: ((active: boolean, reason: string) => void) | null =
    null;

  const releaseCriticalMode = () => {
    if (!isCriticalActive) {
      return;
    }

    isCriticalActive = false;
    traceHomeStartupReady('home_db_low_priority_release', {
      reason: HOME_DB_STARTUP_CRITICAL_REASON,
    });

    if (setCriticalMode) {
      setCriticalMode(false, HOME_DB_STARTUP_CRITICAL_REASON);
      return;
    }

    import('@/databases/sync/scheduler')
      .then(({ setSyncSchedulerCriticalMode }) => {
        setSyncSchedulerCriticalMode(false, HOME_DB_STARTUP_CRITICAL_REASON);
      })
      .catch(error => {
        console.error('release Home DB low priority hold failed', error);
      });
  };

  import('@/databases/sync/scheduler')
    .then(({ setSyncSchedulerCriticalMode }) => {
      if (disposed) {
        return;
      }

      setCriticalMode = setSyncSchedulerCriticalMode;
      isCriticalActive = true;
      traceHomeStartupReady('home_db_low_priority_hold', {
        reason: HOME_DB_STARTUP_CRITICAL_REASON,
      });
      setSyncSchedulerCriticalMode(true, HOME_DB_STARTUP_CRITICAL_REASON);

      releaseHandle = scheduleStartupTask(
        releaseCriticalMode,
        STARTUP_TASKS.homeDbLowPriorityRelease,
      );
    })
    .catch(error => {
      console.error('start Home DB low priority hold failed', error);
    });

  return () => {
    disposed = true;
    cancelStartupTaskHandle(releaseHandle);
    releaseCriticalMode();
  };
}

function HomeDeferredLifecycle() {
  useInitDetectDBAssets();
  useTrack0331HomeActiveSnapshots();

  return null;
}

function HomeStartupReadyScheduler() {
  useEffect(() => {
    resetHomeStartupReady();
    traceHomeStartupReady('home_mount');
    const stopHomeDbLowPriorityHold = startHomeDbLowPriorityHold();
    const stopHomeStartupReady = scheduleHomeStartupReady();

    return () => {
      stopHomeStartupReady();
      stopHomeDbLowPriorityHold();
    };
  }, []);

  return null;
}

function HomeContentReadyScheduler() {
  const homePostStartupReady = useHomePostStartupReady();
  const hasSettledFirstContent = useHomePortfolioStore(state => {
    const hasResolvedAccountContext =
      state.hasResolvedSelection ||
      (state.hasFetchedAccounts && !state.isFetchingAccounts);

    return (
      hasResolvedAccountContext &&
      !state.isPendingDisplayAddresses &&
      !state.showBalanceLoadingWithoutLocal &&
      !state.showChangeLoadingWithoutLocal
    );
  });

  useEffect(() => {
    if (!homePostStartupReady || !hasSettledFirstContent) {
      return;
    }
    markHomeContentReady('portfolio_first_content_settled');
  }, [hasSettledFirstContent, homePostStartupReady]);

  return null;
}

function HomeReadableAccountStoresBootstrap() {
  const homePostStartupReady = useHomePostStartupReady();

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    const homeSceneHandle = scheduleStartupTask(
      () =>
        startHomeSceneDerivedDataActivationWarmup().catch(error => {
          console.error(
            'startHomeSceneDerivedDataActivationWarmup::error',
            error,
          );
          throw error;
        }),
      STARTUP_TASKS.homeSceneDerivedDataActivation,
    );

    const readableAccountHandle = scheduleStartupTask(
      () =>
        startInitReadableAccountStoresIdleWarmup().catch(error => {
          console.error(
            'startInitReadableAccountStoresIdleWarmup::error',
            error,
          );
          throw error;
        }),
      STARTUP_TASKS.readableAccountStoresIdleWarmup,
    );

    return () => {
      cancelStartupTaskHandle(homeSceneHandle);
      cancelStartupTaskHandle(readableAccountHandle);
    };
  }, [homePostStartupReady]);

  return null;
}

function HomePostStartupEffects({
  appThemeConfig,
  trackGasAccountActive,
}: {
  appThemeConfig: ReturnType<typeof useAppThemeConfig>;
  trackGasAccountActive: () => void;
}) {
  const homePostStartupReady = useHomePostStartupReady();

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    const timeoutId = setTimeout(() => {
      deleteLongTimeCurveCache();
      deleteLongTime24hBalanceCache();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [homePostStartupReady]);

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      (async () => {
        traceHomeStartupReady('home_has_visible_accounts_start');
        const { redirectAction } = await detectHasAccounts();
        traceHomeStartupReady('home_has_visible_accounts_end', {
          shouldRedirect: !!redirectAction,
        });
        if (redirectAction) {
          redirectAction();
        }
      })();
    }, [homePostStartupReady]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      trackGasAccountActive();

      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          trackGasAccountActive();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [homePostStartupReady, trackGasAccountActive]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      let cancelled = false;
      import('../GasAccount/hooks/atom')
        .then(({ storeApiGasAccount }) => {
          if (cancelled) {
            return;
          }

          storeApiGasAccount.scheduleSnapshotRefresh({
            reason: 'home_focus',
          });
          autoLoginGasAccountIfNeeded().catch(error => {
            console.error('autoLoginGasAccountIfNeeded error', error);
          });
        })
        .catch(error => {
          console.error('load gas account store api error', error);
        });

      return () => {
        cancelled = true;
      };
    }, [homePostStartupReady]),
  );

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig, homePostStartupReady]);

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    const lastReportTime = getPreferenceSnapshot('lastReportTime') || 0;
    if (!lastReportTime || !dayjs(lastReportTime).isToday()) {
      void Promise.all([
        browserServiceApi.getBrowserTabs(),
        getBrowserBookmarks(),
      ])
        .then(([browserTabs, browserBookmarks]) => {
          matomoRequestEvent({
            category: 'Websites Usage',
            action: 'Website_LikeStatus',
            label: `LikeDapp:${browserBookmarks.ids.length}`,
          });

          matomoRequestEvent({
            category: 'Websites Usage',
            action: 'Website_TabStatus',
            label: `TabNumber:${browserTabs.tabs.length}`,
          });

          matomoRequestEvent({
            category: 'Watchlist Usage',
            action: 'Watchlist_LikeStatus',
            label: `LikeToken:${getPinnedTokenSnapshot().length}`,
          });

          return setPreference({
            lastReportTime: Date.now(),
          });
        })
        .catch(error => {
          console.error('[Home] report daily local state failed', error);
        });
    }
  }, [homePostStartupReady]);

  if (!homePostStartupReady) {
    return null;
  }

  return (
    <>
      <HomeDeferredLifecycle />
      <HomeGuidanceMultipleTabs />
    </>
  );
}

function MultiAddressHome(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  useHomeChainInfoFocus();
  const appThemeConfig = useAppThemeConfig();
  const isLoss = useHomePortfolioStore(state => state.changeData.isLoss);
  useRendererDetect({ name: 'MultiAddressHome' });

  const trackGasAccountActive = useCallback(() => {
    trackGasAccountActiveStatusOncePerDay().catch(error => {
      console.error('trackGasAccountActiveStatusOncePerDay error', error);
    });
  }, []);

  useEffect(() => {
    apisHomeTabIndex.setTabIndex(0);
  }, []);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        isLoss
          ? require('@/assets2024/singleHome/loss-home.png')
          : require('@/assets2024/singleHome/up-home.png')
      }
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 0.26 },
      }}
      overwriteStyle={styles.screenContainer}>
      <ScreenSpecificStatusBar screenName={RootNames.Home} />

      <View
        style={[styles.paddingContainer]}
        onTouchStart={() => {
          setIsFoldMultiChart(true);
        }}>
        <TabsMultiAssets />
      </View>

      <HomeStartupReadyScheduler />
      <HomeContentReadyScheduler />
      <HomeReadableAccountStoresBootstrap />
      <HomePostStartupEffects
        appThemeConfig={appThemeConfig}
        trackGasAccountActive={trackGasAccountActive}
      />

      <TmpHomeRefresher />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    screenContainer: {
      paddingTop: safeAreaInsets.top,
    },
    paddingContainer: {
      paddingHorizontal: 0,
      flex: 1,
      flexGrow: 1,
    },
  }),
);

export default MultiAddressHome;
