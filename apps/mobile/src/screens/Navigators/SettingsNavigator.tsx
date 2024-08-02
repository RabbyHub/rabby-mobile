import { RootNames, makeHeadersPresets } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import SettingsScreen from '../Settings/Settings';
import ProviderControllerTester from '../ProviderControllerTester/ProviderControllerTester';
import SetPasswordScreen from '../ManagePassword/SetPassword';
import { CustomTestnetScreen } from '../CustomTestnet';
import { useSetPasswordFirstState } from '@/hooks/useLock';

const SettingsStack = createCustomNativeStackNavigator();

export function SettingNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
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
        options={{
          title: '',
          headerTitle: 'Settings',
        }}
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
