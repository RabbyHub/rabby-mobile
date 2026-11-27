import { withScreenPropsInjection } from '@/devtools/screenRegistry/screenInjection';
import 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { DappsNavigatorParamsList } from '@/navigation-type';
import { DappsScreen } from '../Dapps/DappsScreen';
import { IS_IOS } from '@/core/native/utils';
import { useStackScreenConfig } from '@/hooks/navigation';
import {
  FavoriteDappsHeaderTitle,
  FavoriteDappsScreen,
} from '../Dapps/FavoriteDappsScreen';
import { renderAppStackHeader } from '@/components/AppStackHeader';

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
          fontWeight: '400',
        },
        headerTintColor: colors['neutral-title-1'],
      })}
      initialRouteName={RootNames.Dapps}>
      <DappsStack.Screen
        name={RootNames.Dapps}
        component={withScreenPropsInjection(DappsScreen)}
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
        component={withScreenPropsInjection(FavoriteDappsScreen)}
        options={mergeScreenOptions({
          // Centred JS header: the native slot (and the Duo replica) centred
          // the title inside the post-back area, so it drifted right; the
          // shared header keeps equal slots on every posture.
          header: renderAppStackHeader(() => ({
            title: 'Favorites',
            // titleNode replaces the auto-fit Text, so it must centre itself
            // inside the stretched title slot.
            titleNode: (
              <View style={styles.headerTitleCenter}>
                <FavoriteDappsHeaderTitle />
              </View>
            ),
          })),
          headerBackVisible: false,
          headerLeft: () => null,
          unstable_headerLeftItems: () => [],
          title: 'Favorites',
        })}
      />
    </DappsStack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitleCenter: {
    alignItems: 'center',
  },
});
