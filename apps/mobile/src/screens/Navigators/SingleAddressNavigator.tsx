import 'react-native-gesture-handler';
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import SingleAddressHome from '../Home/Home';
import { useStackScreenConfig } from '@/hooks/navigation';
import { RightMore } from '../Home/RightMore';
const SingleAddressStack = createCustomNativeStackNavigator();

export function SingleAddressNavigator() {
  const { colors2024 } = useTheme2024();
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[SingleAddressNavigator] Render');
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
          title: '',
          headerTitle: '',
          headerShown: true,
          headerRight: RightMore,
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />
    </SingleAddressStack.Navigator>
  );
}
