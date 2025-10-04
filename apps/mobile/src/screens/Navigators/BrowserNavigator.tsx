import { RootNames } from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { BrowserNavigatorParamsList } from '@/navigation-type';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import 'react-native-gesture-handler';
import { BrowserScreen } from '../Browser/BrowserScreen';

const BrowserStack = createNativeStackNavigator<BrowserNavigatorParamsList>();

export function BrowserNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();

  return (
    <BrowserStack.Navigator
      screenOptions={mergeScreenOptions({
        // gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
        headerTintColor: colors['neutral-title-1'],
      })}
      initialRouteName={RootNames.BrowserScreen}>
      <BrowserStack.Screen
        name={RootNames.BrowserScreen}
        component={BrowserScreen}
        options={{
          title: IS_IOS ? 'Explore' : 'Dapps',
          headerTitleStyle: {
            fontWeight: '500',
          },
          headerTitle: 'Dapps',
          headerTransparent: true,
          headerShown: false,
          // animation: 'none',
        }}
      />
      {/* <BrowserStack.Screen
        name={RootNames.BrowserManageScreen}
        component={BrowserManageScreen}
        options={mergeScreenOptions({
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontWeight: '800',
            color: colors['neutral-title-1'],
          },
          headerShown: false,
          animation: 'none',
        })}
      /> */}
    </BrowserStack.Navigator>
  );
}
