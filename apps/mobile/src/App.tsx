import 'react-native-gesture-handler';
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AppNavigation from '@/AppNavigation';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { useAppTheme, useThemeColors } from '@/hooks/theme';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { withExpoSnack } from 'nativewind';
import React, { Suspense, useCallback, useEffect } from 'react';
import { setup, withIAPContext } from 'react-native-iap';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNames } from './constant/layout';
import { ThemeColors } from './constant/theme';
import { keyringService } from './core/services';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import { useBootstrapApp, useInitializeAppOnTop } from './hooks/useBootstrap';
import { useSecureOnBackground } from './hooks/useLock';
import { replace } from './utils/navigation';
import { useUpgradeInfo } from './hooks/version';
import { AppProvider } from './hooks/global';
import { useGlobalAppPreventScreenrecordOnDev } from './hooks/appSettings';
import { useAppPreventScreenshotOnScreen } from './hooks/navigation';
import { useAutoGoogleSignIfPreviousSignedOnTop } from './hooks/cloudStorage';
import { useNoLongerSupports } from './components2024/NoLongerSupports/useNoLongerSupports';
import { useTriggerI18nChangeOnAppTop } from './hooks/lang';
import { ScreenSceneAccountProvider } from './hooks/accountsSwitcher';
import { useIAPListener } from './hooks/iap/useIAPListener';
import { useGasAccountInfo } from './screens/GasAccount/hooks';
import { useIncreaseTxCountOnAppTop } from './components/RateModal/hooks';
import { useIntervalSyncDDefaultRPCs } from './hooks/defaultRPCs';
import { useUniversalLinkOnTop } from './hooks/universalLink';
import { useUserDidTakeScreenshot } from './components/Screenshot/hooks';
import Safe from '@rabby-wallet/gnosis-sdk';
import { SAFE_API_KEY } from './constant/env';
Safe.apiKey = SAFE_API_KEY;

import { useTrezorConnectOnUrl } from './hooks/trezor/useTrezor';
import usePrevious from 'react-use/lib/usePrevious';
import {
  RerenderDetector,
  useRendererDetect,
} from './components/Perf/PerfDetector';

const rneuiTheme = createTheme({
  lightColors: {
    grey4: ThemeColors.light['neutral-card-2'],
    grey5: ThemeColors.light['neutral-card-3'],
  },
  darkColors: {
    grey4: ThemeColors.dark['neutral-card-2'],
    grey5: ThemeColors.dark['neutral-card-3'],
  },
});

type AppProps = { rabbitCode: string };

const MemoziedAppNav = React.memo(AppNavigation);

const MainScreen = React.memo(({ rabbitCode }: AppProps) => {
  const { isAppUnlocked } = useInitializeAppOnTop();
  const { couldRender, securityChainOnTop } = useBootstrapApp({ rabbitCode });

  useSetupServiceStub();
  useUpgradeInfo({ isTop: true });
  useUniversalLinkOnTop();
  useSecureOnBackground();
  useGlobalAppPreventScreenrecordOnDev();
  useAppPreventScreenshotOnScreen({ isTop: true });
  useAutoGoogleSignIfPreviousSignedOnTop();
  useNoLongerSupports();
  useTriggerI18nChangeOnAppTop();
  useIAPListener();
  useGasAccountInfo();
  useTrezorConnectOnUrl();
  useIncreaseTxCountOnAppTop({ isTop: true });
  useIntervalSyncDDefaultRPCs();
  useUserDidTakeScreenshot({ isTop: true });

  useEffect(() => {
    (async () => {
      if (isAppUnlocked) {
        const accounts = await keyringService.getAllVisibleAccountsArray();
        if (!accounts?.length) {
          replace(RootNames.StackGetStarted, {
            screen: RootNames.GetStartedScreen2024,
          });
        }
      }
    })();
  }, [isAppUnlocked]);

  useRendererDetect({ name: 'MainScreen' });

  return (
    <AppProvider value={{ securityChain: securityChainOnTop }}>
      <RerenderDetector name="AppProvider" />
      <BottomSheetModalProvider>
        <ScreenSceneAccountProvider>
          {couldRender && <MemoziedAppNav />}
        </ScreenSceneAccountProvider>
      </BottomSheetModalProvider>
    </AppProvider>
  );
});

const MemoziedMainScreen = React.memo(MainScreen);

function App({ rabbitCode }: AppProps): JSX.Element {
  return (
    <AppErrorBoundary>
      <ThemeProvider theme={rneuiTheme}>
        <RootSiblingParent>
          <SafeAreaProvider>
            <Suspense fallback={null}>
              {/* TODO: measure to check if memory leak occured when refresh on iOS */}
              <GestureHandlerRootView style={{ flex: 1 }}>
                {/* read from native bundle on production */}
                <MemoziedMainScreen
                  rabbitCode={__DEV__ ? 'RABBY_MOBILE_CODE_DEV' : rabbitCode}
                />
              </GestureHandlerRootView>
            </Suspense>
          </SafeAreaProvider>
        </RootSiblingParent>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default withExpoSnack(withIAPContext(App));
