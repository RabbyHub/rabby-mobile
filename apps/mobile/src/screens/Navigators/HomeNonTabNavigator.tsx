import 'react-native-gesture-handler';
import { makeHeadersPresets, RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { HomeNonTabNavigatorParamsList } from '@/navigation-type';
import SearchScreen from '../Search';
import WatchlistScreen from '../Watchlist';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

const HomeNonTabStack =
  createNativeStackNavigator<HomeNonTabNavigatorParamsList>();

export default function HomeNonTabNavigator() {
  const { colors, colors2024, isLight } = useTheme2024({ getStyle });
  const headerPresets = makeHeadersPresets({ colors, colors2024 });
  const { t } = useTranslation();
  const { mergeScreenOptions } = useStackScreenConfig();
  return (
    <HomeNonTabStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        ...headerPresets.withBgCard2,
        headerShadowVisible: false,
        headerShown: true,
      })}
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
          animation: 'none',
          gestureEnabled: true,
        }}
      />
      <HomeNonTabStack.Screen
        name={RootNames.Watchlist}
        component={WatchlistScreen}
        options={mergeScreenOptions({
          title: t('page.home.services.watchlist'),
          ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />
    </HomeNonTabStack.Navigator>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerTitleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
  },
}));
