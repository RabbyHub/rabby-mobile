import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import SettingsScreen from '../Settings/Settings';
import ProviderControllerTester from '../ProviderControllerTester/ProviderControllerTester';
import SetPasswordScreen from '../ManagePassword/SetPassword';

const SettingsStack = createCustomNativeStackNavigator();

export function SettingNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <SettingsStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
        headerTitle: 'Settings',
        headerTintColor: colors['neutral-title-1'],
      }}>
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
