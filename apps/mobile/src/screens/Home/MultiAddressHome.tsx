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
  getBrowserBookmarkCountSnapshot,
  getBrowserTabCountSnapshot,
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

let hasStartedInitReadableAccountStoresIdleWarmup = false;

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

function HomeDeferredLifecycle() {
  useInitDetectDBAssets();
  useTrack0331HomeActiveSnapshots();

  return null;
}

function HomeStartupReadyScheduler() {
  useEffect(() => {
    resetHomeStartupReady();
    traceHomeStartupReady('home_mount');

    return scheduleHomeStartupReady();
  }, []);

  return null;
}

function HomeReadableAccountStoresBootstrap() {
  const homePostStartupReady = useHomePostStartupReady();

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    const handle = scheduleStartupTask(
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
      if (handle && typeof handle === 'object' && 'cancel' in handle) {
        handle.cancel();
      }
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
      void setPreference({
        lastReportTime: Date.now(),
      }).catch(console.error);

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_LikeStatus',
        label: `LikeDapp:${getBrowserBookmarkCountSnapshot()}`,
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_TabStatus',
        label: `TabNumber:${getBrowserTabCountSnapshot()}`,
      });

      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_LikeStatus',
        label: `LikeToken:${getPinnedTokenSnapshot().length}`,
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
