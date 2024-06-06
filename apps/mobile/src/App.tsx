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
import { RootNames } from './constant/layout';
import { ThemeColors } from './constant/theme';
import { keyringService } from './core/services';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import { useBootstrapApp, useInitializeAppOnTop } from './hooks/useBootstrap';
import { replace } from './utils/navigation';
import JotaiNexus from './components/JotaiNexus';
import { useUpgradeInfo } from './hooks/version';

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
  const { appUnlocked } = useInitializeAppOnTop();
  const { couldRender } = useBootstrapApp();
  const { binaryTheme } = useAppTheme({ isAppTop: true });

  useSetupServiceStub();
  useUpgradeInfo({ isTop: true });

  const initAccounts = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
      });
    }
  });

  useEffect(() => {
    if (appUnlocked) {
      initAccounts();
    }
  }, [appUnlocked, initAccounts]);

  return (
    <BottomSheetModalProvider>
      {couldRender && <AppNavigation colorScheme={binaryTheme} />}
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
              <JotaiNexus />
            </Suspense>
          </SafeAreaProvider>
        </RootSiblingParent>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default withExpoSnack(App);
