import { RootNames } from '@/constant/layout';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { apisAccount } from '@/core/apis';
import { browserService, preferenceService } from '@/core/services';
import { apisHomeTabIndex, resetNavigationTo } from '@/hooks/navigation';
import { matomoRequestEvent } from '@/utils/analytics';
import { getReadyNavigationInstance } from '@/utils/navigation';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { HomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import { useScene24hBalanceLightWeightData } from '@/hooks/useScene24hBalance';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import dayjs from 'dayjs';
import { setIsFoldMultiChart } from '../Address/components/MultiAssets/RenderRow/CurveChart';
import { TabsMultiAssets } from '../Address/components/MultiAssets/TabsMultiAssets';
import { useInitDetectDBAssets } from '../Search/useAssets';
import { TmpHomeRefresher } from './components/TmpHomeRefresher';

const detectHasAccounts = async () => {
  const result = { redirectAction: null as Function | null };
  const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();

  if (!hasAccountsInKeyring) {
    result.redirectAction = () => {
      const navigation = getReadyNavigationInstance();
      navigation &&
        resetNavigationTo(navigation, RootNames.GetStartedScreen2024);
    };
  }

  return result;
};

function MultiAddressHome(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const appThemeConfig = useAppThemeConfig();

  const combinedData = useScene24hBalanceLightWeightData('Home');
  useRendererDetect({ name: 'MultiAddressHome' });

  useInitDetectDBAssets();

  useEffect(() => {
    setTimeout(() => {
      deleteLongTimeCurveCache();
      deleteLongTime24hBalanceCache();
    }, 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { redirectAction } = await detectHasAccounts();
        if (redirectAction) {
          redirectAction();
        }
      })();
    }, []),
  );

  useEffect(() => {
    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig]);

  useEffect(() => {
    const lastReportTime =
      preferenceService.getPreference('lastReportTime') || 0;
    if (!lastReportTime || !dayjs(lastReportTime).isToday()) {
      preferenceService.setPreference({
        lastReportTime: Date.now(),
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_LikeStatus',
        label: `LikeDapp:${
          browserService.bookmark.getState().ids?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_TabStatus',
        label: `TabNumber:${
          browserService.getBrowserTabs()?.tabs?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_LikeStatus',
        label: `LikeToken:${
          preferenceService.getPreference('pinedQueue')?.length || 0
        }`,
      });
    }
  }, []);

  useEffect(() => {
    apisHomeTabIndex.setTabIndex(0);
  }, []);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        combinedData.isLoss
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

      <HomeGuidanceMultipleTabs />

      <TmpHomeRefresher />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    screenContainer: {
      paddingTop: 0,
    },
    paddingContainer: {
      paddingHorizontal: 0,
      flex: 1,
      flexGrow: 1,
    },
  }),
);

export default MultiAddressHome;
