import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import GetStartedScreen from '../GetStarted/GetStarted';
import GetStartedScreen2024 from '../GetStarted/NewUserGetStarted2024';
import { HomeNonTabNavigatorParamsList } from '@/navigation-type';
import SearchScreen from '../Search';

const HomeNonTabStack =
  createCustomNativeStackNavigator<HomeNonTabNavigatorParamsList>();

export default function HomeNonTabNavigator() {
  const colors = useThemeColors();

  return (
    <HomeNonTabStack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarColor: colors['blue-default'],
      }}
      initialRouteName={RootNames.Search}>
      <HomeNonTabStack.Screen
        name={RootNames.Search}
        component={SearchScreen}
        options={{
          title: 'Search',
          headerTitleStyle: {
            fontWeight: '500',
          },
          headerTitle: 'Search',
          headerTransparent: true,
          headerShown: false,
        }}
      />
    </HomeNonTabStack.Navigator>
  );
}
