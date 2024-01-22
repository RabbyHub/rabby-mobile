/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { Suspense, useEffect } from 'react';
import { withExpoSnack } from 'nativewind';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import { RootSiblingParent } from 'react-native-root-siblings';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppTheme } from '@/hooks/theme';
import AppNavigation from '@/AppNavigation';
// import JotaiNexus from '@/components/JotaiNexus';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { useInitializeAppOnTop, useBootstrapApp } from './hooks/useBootstrap';
import { ThemeProvider } from '@rneui/themed';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import { useMemoizedFn } from 'ahooks';
import { preferenceService } from './core/services/shared';
import { navigate } from './utils/navigation';
import { StackActions, useNavigation } from '@react-navigation/native';
import { RootNames } from './constant/layout';
import { keyringService } from './core/services';

function MainScreen() {
  useInitializeAppOnTop();
  const { couldRender } = useBootstrapApp();
  const { binaryTheme } = useAppTheme({ isAppTop: true });

  useSetupServiceStub();

  const init = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccounts();
    if (!accounts?.length) {
      navigate(RootNames.StackGetStarted);
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
      <ThemeProvider>
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
