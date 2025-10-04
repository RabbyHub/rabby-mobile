import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { DappsNavigatorParamsList } from '@/navigation-type';
import { DappsScreen } from '../Dapps/DappsScreen';
import { IS_IOS } from '@/core/native/utils';
import { useStackScreenConfig } from '@/hooks/navigation';
import { FavoriteDappsScreen } from '../Dapps/FavoriteDappsScreen';

const DappsStack = createNativeStackNavigator<DappsNavigatorParamsList>();

export function DappsNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <DappsStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
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
      initialRouteName={RootNames.Dapps}>
      <DappsStack.Screen
        name={RootNames.Dapps}
        component={DappsScreen}
        options={{
          title: IS_IOS ? 'Explore' : 'Dapps',
          headerTitleStyle: {
            fontWeight: '500',
          },
          headerTitle: 'Dapps',
          headerTransparent: true,
          headerShown: false,
        }}
      />
      <DappsStack.Screen
        name={RootNames.FavoriteDapps}
        component={FavoriteDappsScreen}
        options={mergeScreenOptions({
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontWeight: '800',
            color: colors['neutral-title-1'],
          },
        })}
      />
    </DappsStack.Navigator>
  );
}
