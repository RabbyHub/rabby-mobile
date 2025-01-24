import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { registerAppScreen } from '@/perfs/apis';
import {
  preloadNonProductionScreens,
  TESTKITS_PRELOAD_SCREENS,
} from '@/perfs/preloads';
import { useLayoutEffect } from 'react';
import { devOnlyDelayNavi } from '../Testkits/testkits-utils';

const GetStartedScreen2024 = registerAppScreen<
  typeof import('@/screens/GetStarted/NewUserGetStarted2024').default
>({
  loader: () => import('@/screens/GetStarted/NewUserGetStarted2024'),
  name: TESTKITS_PRELOAD_SCREENS.NewUserGetStarted2024,
});
const DevUIFontShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFontShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFontShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIFontShowCase,
});
const DevUIFormShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFormShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFormShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIFormShowCase,
});
const DevUIAccountShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIAccountShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIAccountShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIAccountShowCase,
});
const DevUIScreenContainerShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIScreenContainerShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIScreenContainerShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIScreenContainerShowCase,
});
const DevUIDapps = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIDapps').default
>({
  loader: () => import('@/screens/Testkits/DevUIDapps'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIDapps,
});
const DevDataSQLite = registerAppScreen<
  typeof import('@/screens/Testkits/DevDataSQLite').default
>({
  loader: () => import('@/screens/Testkits/DevDataSQLite'),
  name: TESTKITS_PRELOAD_SCREENS.DevDataSQLite,
});

const Stack = createCustomNativeStackNavigator();

// devOnlyDelayNavi(
//   ({ naviPush, RootNames }) => {
//     naviPush(RootNames.StackTestkits, {
//       screen: RootNames.DevDataSQLite,
//     });
//   },
//   { timeout: 5 * 1e3 },
// );

export function TestkitsNavigator() {
  // const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  useLayoutEffect(() => {
    preloadNonProductionScreens();
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarColor: colors['blue-default'],
      }}>
      <Stack.Screen
        name={RootNames.NewUserGetStarted2024}
        component={GetStartedScreen2024}
        // options={{
        //   navigationBarHidden: true,
        // }}
      />
      <Stack.Screen
        name={RootNames.DevUIFontShowCase}
        component={DevUIFontShowCase}
      />
      <Stack.Screen
        name={RootNames.DevUIFormShowCase}
        component={DevUIFormShowCase}
      />
      <Stack.Screen
        name={RootNames.DevUIAccountShowCase}
        component={DevUIAccountShowCase}
      />
      <Stack.Screen
        name={RootNames.DevUIScreenContainerShowCase}
        component={DevUIScreenContainerShowCase}
      />
      <Stack.Screen name={RootNames.DevUIDapps} component={DevUIDapps} />

      <Stack.Screen name={RootNames.DevDataSQLite} component={DevDataSQLite} />
    </Stack.Navigator>
  );
}
