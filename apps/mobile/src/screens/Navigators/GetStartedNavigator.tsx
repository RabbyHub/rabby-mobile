import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';
import GetStartedScreen2024 from '../GetStarted/NewUserGetStarted2024';

const Stack = createNativeStackNavigator();

export function GetStartedNavigator() {
  // const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={RootNames.GetStartedScreen2024}>
      <Stack.Screen
        name={RootNames.GetStarted}
        component={GetStartedScreen}
        // options={{
        //   navigationBarHidden: true,
        // }}
      />
      <Stack.Screen
        name={RootNames.GetStartedScreen2024}
        component={GetStartedScreen2024}
        // options={{
        //   navigationBarHidden: true,
        // }}
      />
    </Stack.Navigator>
  );
}
