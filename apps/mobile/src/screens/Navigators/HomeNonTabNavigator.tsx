import 'react-native-gesture-handler';
import { makeHeadersPresets, RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { HomeNonTabNavigatorParamsList } from '@/navigation-type';
import SearchScreen from '../Search';
import WatchlistScreen from '../Watchlist';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

const HomeNonTabStack =
  createCustomNativeStackNavigator<HomeNonTabNavigatorParamsList>();

export default function HomeNonTabNavigator() {
  const { colors, colors2024, styles } = useTheme2024({ getStyle });
  const headerPresets = makeHeadersPresets({ colors, colors2024 });
  const { t } = useTranslation();
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
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
          gestureEnabled: true,
        }}
      />
      <HomeNonTabStack.Screen
        name={RootNames.Watchlist}
        component={WatchlistScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: t('page.home.services.watchlist'),
            title: t('page.home.services.watchlist'),
            headerTransparent: false,
            headerStyle: {
              backgroundColor: colors2024['neutral-bg-0'],
            },
            headerShown: true,
            headerTitleStyle: styles.headerTitleText,
          },
        ])}
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
