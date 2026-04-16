import { RootNames, makeHeadersPresets } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { CustomTestnetScreen } from '../CustomTestnet';
import { registerAppScreen } from '@/perfs/apis';

const SettingsScreen = registerAppScreen<
  typeof import('../Settings/Settings').default
>({
  loader: () => import('../Settings/Settings'),
});
const SetPasswordScreen = registerAppScreen<
  typeof import('../ManagePassword/SetPassword').default
>({
  loader: () => import('../ManagePassword/SetPassword'),
});
const ProviderControllerTester = registerAppScreen<
  typeof import('../ProviderControllerTester/ProviderControllerTester').default
>({
  loader: () => import('../ProviderControllerTester/ProviderControllerTester'),
});
import { I18nRouteScreenTitle } from '@/components2024/i18n/RouteScreen';

const SettingsStack = createNativeStackNavigator();

export function SettingNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');
  const headerPresets = makeHeadersPresets({ colors });

  return (
    <SettingsStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
        },
        headerTitle: 'Settings',
        headerTintColor: colors['neutral-title-1'],
      })}>
      <SettingsStack.Screen
        name={RootNames.Settings}
        component={SettingsScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: () => (
              <I18nRouteScreenTitle
                i18nTitle={({ t }) => t('page.setting.screenTitle')}
                style={{
                  fontWeight: '900',
                }}
              />
            ),
            headerTitleAlign: 'center',
            headerTintColor: colors['neutral-title-1'],
          },
        ])}
      />
      <SettingsStack.Screen
        name={RootNames.SetPassword}
        component={SetPasswordScreen}
        options={{
          title: '',
          headerTitle: '',
          headerTintColor: colors['neutral-title2'],
          headerTitleStyle: {
            color: colors['neutral-title2'],
          },
          animation: 'fade_from_bottom',
          animationTypeForReplace: 'pop',
          // ...(isOnSettingsWaiting && {
          // }),
        }}
      />
      <SettingsStack.Screen
        name={RootNames.CustomTestnet}
        component={CustomTestnetScreen}
        options={{
          title: 'Custom Network',
          headerTitle: 'Custom Network',
          ...headerPresets.withBgCard2,
        }}
      />
      {__DEV__ && (
        <SettingsStack.Screen
          name={RootNames.ProviderControllerTester}
          component={ProviderControllerTester}
          options={{
            title: 'Settings',
          }}
        />
      )}
    </SettingsStack.Navigator>
  );
}
