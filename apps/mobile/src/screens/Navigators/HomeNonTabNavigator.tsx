import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { HomeNonTabNavigatorParamsList } from '@/navigation-type';
import { registerAppScreen } from '@/perfs/apis';

const SearchScreen = registerAppScreen<typeof import('../Search').default>({
  loader: () => import('../Search'),
  name: RootNames.Search,
});

const HomeNonTabStack =
  createCustomNativeStackNavigator<HomeNonTabNavigatorParamsList>();

export default function HomeNonTabNavigator() {
  return (
    <HomeNonTabStack.Navigator
      screenOptions={{
        headerShown: false,
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
