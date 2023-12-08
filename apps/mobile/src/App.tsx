/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { Suspense, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
// import { RootSiblingParent } from 'react-native-root-siblings';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/theme';
import AppNavigation from '@/AppNavigation';
import JotaiNexus from './components/JotaiNexus';
import { useBootstrapApp } from './hooks/useBootstrap';

function MainScreen() {
  const { couldRender } = useBootstrapApp();
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  return (
    <>
      {couldRender && <AppNavigation colorScheme={colorScheme} />}
      <JotaiNexus />
    </>
  );
}

function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <Suspense fallback={null}>
        {/* TODO: measure to check if memory leak occured when refresh on iOS */}
        {/* <GestureHandlerRootView style={{ flex: 1 }}>
          <MainScreen />
        </GestureHandlerRootView> */}
        <MainScreen />
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
