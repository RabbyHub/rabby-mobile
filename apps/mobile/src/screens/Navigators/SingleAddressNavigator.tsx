import 'react-native-gesture-handler';
import React from 'react';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { RightArea } from '../Home/SingleHomeRightArea';
import { registerAppScreen } from '@/perfs/apis';
const SingleAddressStack = createCustomNativeStackNavigator();

const SingleAddressHome = registerAppScreen<
  typeof import('../Home/Home').default
>({
  loader: () => import('../Home/Home'),
  name: RootNames.SingleAddressHome,
});

export function SingleAddressNavigator() {
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
          headerRight: RightArea,
          headerStyle: {
            backgroundColor: 'transparent',
          },
        })}
      />
    </SingleAddressStack.Navigator>
  );
}
