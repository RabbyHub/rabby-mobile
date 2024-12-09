import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';
import GetStartedScreen2024 from '../GetStarted/NewUserGetStarted2024';
import DevUIFontShowCase from '../Testkits/DevUIFontShowCase';
import DevUIFormShowCase from '../Testkits/DevUIFormShowCase';
import DevUIAccountShowCase from '../Testkits/DevUIAccountShowCase';
import DevUIScreenContainerShowCase from '../Testkits/DevUIScreenContainerShowCase';
import DevUIDapps from '../Testkits/DevUIDapps';

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
        name={RootNames.TestKits}
        component={GetStartedScreen}
        // options={{
        //   navigationBarHidden: true,
        // }}
      />
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
