import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DebugLogViewer,
  DevDataSQLite,
  DevPerf,
  DevSwitches,
  DevUIAccountShowCase,
  DevUIAnimatedTextAndView,
  DevUIBuiltInPages,
  DevUIComponents2024ShowCase,
  DevUIDapps,
  DevUIFontShowCase,
  DevUIFormShowCase,
  DevUINotifications,
  DevUIPermissions,
  DevUIScreenContainerShowCase,
  DevUIToast,
} from '@/perfs/loadables/testkitsNavigatorScreens';

const Stack = createNativeStackNavigator();

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
  // console.log('============== TestkitsNavigator Render =========');

  // useLayoutEffect(() => {
  //   preloadNonProductionScreens();
  // }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarBackgroundColor: colors['blue-default'],
      }}>
      <Stack.Screen
        name={RootNames.DevUIAnimatedTextAndView}
        component={DevUIAnimatedTextAndView}
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
        name={RootNames.DevUIComponents2024ShowCase}
        component={DevUIComponents2024ShowCase}
      />
      <Stack.Screen
        name={RootNames.DevUIScreenContainerShowCase}
        component={DevUIScreenContainerShowCase}
      />
      <Stack.Screen name={RootNames.DevUIToast} component={DevUIToast} />
      <Stack.Screen
        name={RootNames.DevUINotifications}
        component={DevUINotifications}
      />
      <Stack.Screen name={RootNames.DevUIDapps} component={DevUIDapps} />
      <Stack.Screen
        name={RootNames.DevUIBuiltInPages}
        component={DevUIBuiltInPages}
      />
      <Stack.Screen
        name={RootNames.DevUIPermissions}
        component={DevUIPermissions}
      />

      <Stack.Screen name={RootNames.DevDataSQLite} component={DevDataSQLite} />

      <Stack.Screen
        name={RootNames.DevSwitches}
        component={DevSwitches}
        options={{
          headerShown: true,
          // presentation: 'modal',
        }}
      />
      <Stack.Screen
        name={RootNames.DevPerf}
        component={DevPerf}
        options={{
          headerShown: true,
          // presentation: 'modal',
        }}
      />
      <Stack.Screen
        name={RootNames.DebugLogViewer}
        component={DebugLogViewer}
        options={{
          headerShown: true,
          title: 'App Log Verification',
        }}
      />
    </Stack.Navigator>
  );
}
