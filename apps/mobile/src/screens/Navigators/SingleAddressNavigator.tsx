import 'react-native-gesture-handler';
import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import SingleAddressHome from '../SingleAddreesHome/Home';
import SettingsScreen from '../Settings/Settings';
import { useStackScreenConfig } from '@/hooks/navigation';
import { RightMore } from '../SingleAddreesHome/RightMore';
import { DappsScreen } from '@/screens/Dapps/DappsScreen';
const isIOS = Platform.OS === 'ios';
const SingleAddressStack = createCustomNativeStackNavigator();

export function SingleAddressNavigator() {
  const { colors2024, colors } = useTheme2024();
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  return (
    <SingleAddressStack.Navigator
      screenOptions={{
        headerTitleAlign: 'left',
      }}>
      <SingleAddressStack.Screen
        name={RootNames.SingleAddressHome}
        component={SingleAddressHome}
        options={mergeScreenOptions({
          headerShown: true,
          headerRight: RightMore,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-2'],
          },
        })}
      />
      <SingleAddressStack.Screen
        name={RootNames.Dapps}
        component={DappsScreen}
        options={{
          title: isIOS ? 'Explore' : 'Dapps',
          headerTitleStyle: {
            fontWeight: '500',
          },
          headerTitle: 'Dapps',
          headerTransparent: true,
          headerShown: false,
        }}
      />
      <SingleAddressStack.Screen
        name={RootNames.Settings}
        component={SettingsScreen}
        options={useMemo(
          () =>
            mergeScreenOptions({
              headerTitle: 'Settings',
              headerTitleStyle: {
                fontWeight: '500',
                fontSize: 20,
                color: colors['neutral-title-1'],
              },
              gestureEnabled: false,
              headerTitleAlign: 'center',
              headerTintColor: colors['neutral-title-1'],
            }),
          [colors, mergeScreenOptions],
        )}
      />
    </SingleAddressStack.Navigator>
  );
}
