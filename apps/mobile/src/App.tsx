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
import React, { Suspense, useEffect } from 'react';
import {
  GestureHandlerRootView,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNames } from './constant/layout';
import { ThemeColors } from './constant/theme';
import { keyringService } from './core/services';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import { useBootstrapApp, useInitializeAppOnTop } from './hooks/useBootstrap';
import { useSecureOnBackground } from './hooks/useLock';
import { replace } from './utils/navigation';
import JotaiNexus from './components/JotaiNexus';
import { useUpgradeInfo } from './hooks/version';
import { AppProvider } from './hooks/global';
import { useGlobalAppPreventScreenshotOnDev } from './hooks/appSettings';
import { useAppPreventScreenshotOnScreen } from './hooks/navigation';

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

function MainScreen({ rabbitCode }: AppProps) {
  const { isAppUnlocked } = useInitializeAppOnTop();
  const { couldRender, securityChainOnTop } = useBootstrapApp({ rabbitCode });
  const { binaryTheme } = useAppTheme({ isAppTop: true });

  useSetupServiceStub();
  useUpgradeInfo({ isTop: true });
  useSecureOnBackground();
  useGlobalAppPreventScreenshotOnDev();
  useAppPreventScreenshotOnScreen();

  const initAccounts = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
      });
    }
  });

  useEffect(() => {
    if (isAppUnlocked) {
      initAccounts();
    }
  }, [isAppUnlocked, initAccounts]);

  return (
    <AppProvider value={{ securityChain: securityChainOnTop }}>
      <BottomSheetModalProvider>
        {couldRender && <AppNavigation colorScheme={binaryTheme} />}
      </BottomSheetModalProvider>
    </AppProvider>
  );
}

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
                <MainScreen
                  rabbitCode={__DEV__ ? 'RABBY_MOBILE_CODE_DEV' : rabbitCode}
                />
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
