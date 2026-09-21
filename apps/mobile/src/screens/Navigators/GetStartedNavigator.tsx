import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';

const Stack = createNativeStackNavigator();

export function GetStartedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={RootNames.GetStarted}>
      <Stack.Screen name={RootNames.GetStarted} component={GetStartedScreen} />
    </Stack.Navigator>
  );
}
