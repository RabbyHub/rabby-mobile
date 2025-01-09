import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { registerAppScreen } from '@/perfs/apis';

const GetStartedScreen2024 = registerAppScreen<
  typeof import('@/screens/GetStarted/NewUserGetStarted2024').default
>({
  loader: () => import('@/screens/GetStarted/NewUserGetStarted2024'),
  name: RootNames.NewUserGetStarted2024,
});
const DevUIFontShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFontShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFontShowCase'),
  name: RootNames.DevUIFontShowCase,
});
const DevUIFormShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFormShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFormShowCase'),
  name: RootNames.DevUIFormShowCase,
});
const DevUIAccountShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIAccountShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIAccountShowCase'),
  name: RootNames.DevUIAccountShowCase,
});
const DevUIScreenContainerShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIScreenContainerShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIScreenContainerShowCase'),
  name: RootNames.DevUIScreenContainerShowCase,
});
const DevUIDapps = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIDapps').default
>({
  loader: () => import('@/screens/Testkits/DevUIDapps'),
  name: RootNames.DevUIDapps,
});

const Stack = createCustomNativeStackNavigator();

export function TestkitsNavigator() {
  // const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

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
    </Stack.Navigator>
  );
}
