import { withScreenPropsInjection } from '@/devtools/screenRegistry/screenInjection';
import { RoundedFontStyles } from '@/core/utils/fonts';
import 'react-native-gesture-handler';
import { makeHeadersPresets, RootNames } from '@/constant/layout';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { HomeNonTabNavigatorParamsList } from '@/navigation-type';
import {
  useRabbyAppNavigation,
  useStackScreenConfig,
} from '@/hooks/navigation';
import {
  MarketScreen,
  MemeScreen,
  SearchScreen,
  WatchlistScreen,
} from '@/perfs/loadables/homeNonTabNavigatorScreens';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcNextSearchCC } from '@/assets/icons/common';

const HomeNonTabStack =
  createNativeStackNavigator<HomeNonTabNavigatorParamsList>();

/**
 * Route-level trailing action for Market (P6): declared on the route instead of
 * being installed from the screen after mount. Kept local to the navigator so
 * the Market screen stays inside its loadable chunk.
 */
function MarketHeaderRight() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getHeaderStyles });
  const navigation = useRabbyAppNavigation();

  return (
    <CustomTouchableOpacity
      as="RNGHTouchableOpacity"
      hitSlop={10}
      style={styles.headerRight}
      onPress={() => {
        navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
          screen: RootNames.Search,
          params: {},
        });
      }}>
      <RcNextSearchCC
        width={20}
        height={20}
        color={colors2024['neutral-title-1']}
      />
    </CustomTouchableOpacity>
  );
}

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
        component={withScreenPropsInjection(SearchScreen)}
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
        name={RootNames.Market}
        component={withScreenPropsInjection(MarketScreen)}
        options={mergeScreenOptions({
          title: t('page.home.services.market'),
          headerRight: () => <MarketHeaderRight />,
          ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
        })}
      />
      <HomeNonTabStack.Screen
        name={RootNames.Watchlist}
        component={withScreenPropsInjection(WatchlistScreen)}
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
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
        })}
      />
      <HomeNonTabStack.Screen
        name={RootNames.Meme}
        component={withScreenPropsInjection(MemeScreen)}
        options={mergeScreenOptions({
          title: t('page.home.services.meme'),
          ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
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
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
  },
}));

const getHeaderStyles = createGetStyles2024(() => ({
  headerRight: {
    width: 28,
    height: 28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
