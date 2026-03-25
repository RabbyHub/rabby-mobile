import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';
import GetStartedScreen2024 from '../GetStarted/NewUserGetStarted2024';

const Stack = createNativeStackNavigator();

export function GetStartedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={RootNames.GetStarted}>
      <Stack.Screen name={RootNames.GetStarted} component={GetStartedScreen} />
      <Stack.Screen
        name={RootNames.GetStartedScreen2024}
        component={GetStartedScreen2024}
      />
    </Stack.Navigator>
  );
}
