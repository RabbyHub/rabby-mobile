import 'react-native-gesture-handler';
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AppNavigation from '@/AppNavigation';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { withExpoSnack } from 'nativewind';
import React, { Suspense, useCallback, useEffect } from 'react';
import { setup, withIAPContext } from 'react-native-iap';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeColors } from './constant/theme';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import {
  useAppCouldRender,
  useBootstrapApp,
  useInitializeAppOnTop,
} from './hooks/useBootstrap';
import { AppProvider, loadSecurityChain } from './hooks/global';
import { useNoLongerSupports } from './components2024/NoLongerSupports/useNoLongerSupports';
import { useTriggerI18nChangeOnAppTop } from './hooks/lang';
import { ScreenSceneAccountProvider } from './hooks/accountsSwitcher';
import { useIAPListener } from './hooks/iap/useIAPListener';
import { useIncreaseTxCountOnAppTop } from './components/RateModal/hooks';
import { useUniversalLinkOnTop } from './hooks/universalLink';
import Safe from '@rabby-wallet/gnosis-sdk';
import { SAFE_API_KEY } from './constant/env';
Safe.apiKey = SAFE_API_KEY;

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
  useInitializeAppOnTop();
  useBootstrapApp({ rabbitCode });

  useSetupServiceStub();
  useUniversalLinkOnTop();
  useNoLongerSupports();
  useTriggerI18nChangeOnAppTop();
  useIAPListener();
  useIncreaseTxCountOnAppTop({ isTop: true });

  useRendererDetect({ name: 'MainScreen' });

  const { couldRender } = useAppCouldRender();

  return (
    <AppProvider
      value={{ rabbitCode, securityChain: loadSecurityChain({ rabbitCode }) }}>
      <RerenderDetector name="UnderAppProvider" />
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
