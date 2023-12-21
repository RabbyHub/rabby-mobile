import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import SettingsScreen from '../Settings/Settings';

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
      }}>
      <SettingsStack.Screen
        name={RootNames.Settings}
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      {/* {__DEV__ && (
        <SettingsStack.Screen
          name={RootNames.SettingsWebViewTester}
          component={ModalWebViewTesterScreen}
          options={{
            title: 'Settings',
          }}
        />
      )} */}
    </SettingsStack.Navigator>
  );
}
