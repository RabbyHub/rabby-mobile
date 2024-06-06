import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';

const Stack = createCustomNativeStackNavigator();

export function GetStartedNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarColor: colors['blue-default'],
      }}>
      <Stack.Screen
        name={RootNames.GetStarted}
        component={GetStartedScreen}
        // options={{
        //   navigationBarHidden: true,
        // }}
      />
    </Stack.Navigator>
  );
}
