/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AppNavigation from '@/AppNavigation';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { useAppTheme } from '@/hooks/theme';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { withExpoSnack } from 'nativewind';
import React, { Suspense, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import { RootNames } from './constant/layout';
import { ThemeColors } from './constant/theme';
import { keyringService } from './core/services';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import { useBootstrapApp, useInitializeAppOnTop } from './hooks/useBootstrap';
import { replace } from './utils/navigation';

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

function MainScreen() {
  useInitializeAppOnTop();
  const { couldRender } = useBootstrapApp();
  const { binaryTheme } = useAppTheme({ isAppTop: true });

  useSetupServiceStub();

  const init = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccounts();
    if (!accounts?.length) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
      });
    }
    SplashScreen.hide();
  });

  useEffect(() => {
    if (couldRender) {
      init();
    }
  }, [couldRender, init]);

  return (
    <BottomSheetModalProvider>
      {couldRender && <AppNavigation colorScheme={binaryTheme} />}
      {/* <JotaiNexus /> */}
    </BottomSheetModalProvider>
  );
}

function App(): JSX.Element {
  return (
    <AppErrorBoundary>
      <ThemeProvider theme={rneuiTheme}>
        <RootSiblingParent>
          <SafeAreaProvider>
            <Suspense fallback={null}>
              {/* TODO: measure to check if memory leak occured when refresh on iOS */}
              <GestureHandlerRootView style={{ flex: 1 }}>
                <MainScreen />
              </GestureHandlerRootView>
              {/* <MainScreen /> */}
            </Suspense>
          </SafeAreaProvider>
        </RootSiblingParent>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default withExpoSnack(App);
