import {
  ColorSchemeName,
  Platform,
  StyleSheet,
  View,
  StatusBar,
} from 'react-native';
import {isValidElementType} from 'react-is';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {createCustomNativeStackNavigator as createNativeStackNavigator} from '@/utils/CustomNativeStackNavigator';
import {useEffect, useRef, useCallback} from 'react';

// import FastImage from 'react-native-fast-image';
import {Colors} from '@/constant/theme';

import {
  RcIconNavigationHomeLight,
  RcIconNavigationDappsLight,
} from '@/assets/icons/bottom-bar';

import {useThemeColors, useColorScheme} from '@/hooks/theme';

import {navigationRef} from '@/utils/navigation';
import {useStackScreenConfig} from './hooks/navigation';
// import {analytics} from './utils/analytics';
import {WelcomeScreen} from './screens';
import NotFoundScreen from './screens/NotFound';
import SampleScreen from './screens/Sample/Sample';
import {Text} from './components';
import HomeScreen from './screens/Home/Home';
import {ScreenLayouts} from './constant/layout';

const RootStack = createNativeStackNavigator();
const BottomTab = createBottomTabNavigator();
// const SettingsStack = createNativeStackNavigator();
// const OfficalAccountStack = createNativeStackNavigator();
// const StreamStack = createNativeStackNavigator();
// const BadgeStack = createNativeStackNavigator();

const RootOptions = {animation: 'none'} as const;
const RootStackOptions = {
  animation: 'slide_from_right',
  headerShown: false,
} as const;

const BottomTabIcon = ({
  icon: Icon,
  ...otherProps
}: {
  icon: MemoziedAppSvgIcon | React.ReactNode;
} & React.ComponentProps<MemoziedAppSvgIcon>) => {
  if (!isValidElementType(Icon)) {
    return Icon || null;
  }

  return !Icon ? null : <Icon width={24} height={24} {...otherProps} />;
};

const tabBarLabelStyle = {
  fontSize: 11,
  width: '100%',
  paddingTop: 6,
  fontWeight: '600',
  textAlign: 'center',
  // fontFamily: 'SF Pro',
} as const;

const BottomTabLabel = ({
  label,
  children = label,
  focused,
}: React.PropsWithChildren<{
  label?: string;
  focused: boolean;
}>) => {
  const colors = useThemeColors();

  return (
    <Text
      style={{
        ...tabBarLabelStyle,
        color: focused ? colors['blue-default'] : colors['neutral-foot'],
      }}>
      {children}
    </Text>
  );
};

export default function AppNavigation({
  colorScheme,
}: {
  colorScheme: ColorSchemeName;
}) {
  const routeNameRef = useRef<string>();
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';
  // console.log('============== AppNavigation Render =========');
  useEffect(
    () => {
      // TODO: this may cause crash?
      // FastImage.clearMemoryCache();
    },
    [
      /* userId */
    ],
  );

  // useLoginTestAccount();

  const onReady = useCallback(() => {
    routeNameRef.current = navigationRef?.getCurrentRoute()?.name;
    // analytics.logScreenView({
    //   screen_name: routeNameRef.current,
    //   screen_class: routeNameRef.current,
    // });
  }, []);

  const onStateChange = useCallback(async () => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;
    if (!__DEV__ && previousRouteName !== currentRouteName) {
      // await analytics.logScreenView({
      //   screen_name: currentRouteName,
      //   screen_class: currentRouteName,
      // });
    }
    routeNameRef.current = currentRouteName;
  }, []);

  return (
    <View style={{flex: 1}}>
      {/* <StatusBar
        translucent
        barStyle={isLight ? 'dark-content' : 'light-content'}
      /> */}
      <NavigationContainer
        ref={navigationRef}
        // key={userId}
        onReady={onReady}
        onStateChange={onStateChange}
        // linking={LinkingConfiguration}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator
          screenOptions={RootStackOptions}
          initialRouteName={'Root'}>
          <RootStack.Screen
            name="Root"
            component={BottomTabNavigator}
            options={RootOptions}
          />
          <RootStack.Screen name="Login" component={WelcomeScreen} />
          <RootStack.Screen
            name="NotFound"
            component={NotFoundScreen}
            options={{
              ...screenOptions,
              title: 'Rabby Wallet',
              headerShadowVisible: false,
              headerShown: true,
              headerTransparent: false,
              headerStyle: {
                backgroundColor: '#fff',
              },
            }}
          />
          {/* <RootStack.Screen
            name="SettingsDetail"
            component={SettingNavigator}
          /> */}
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const BottomTabNavigator = () => {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const styles = getStyles(colors);

  console.log('BottomTabNavigator Render');

  return (
    <>
      <BottomTab.Navigator
        sceneContainerStyle={{backgroundColor: colors['neutral-bg-1']}}
        screenOptions={{
          tabBarInactiveTintColor: isDark
            ? 'rgba(223, 223, 223, 0.4)'
            : 'rgba(25, 35, 60, 0.4)',
          tabBarActiveTintColor: colors['neutral-bg-1'],
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: true,
          headerTintColor: colors['neutral-bg-1'],
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTransparent: true,
          tabBarStyle: {
            position: 'absolute',
            // height: Platform.OS === 'ios' ? 90 : 70,
            height: ScreenLayouts.bottomBarHeight,
            borderTopColor: colors['neutral-line'],
            borderTopWidth: 1,
            backgroundColor: colors['neutral-bg-1'],
          },
          tabBarLabelStyle: {...tabBarLabelStyle},
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            height: 90,
            paddingTop: 13,
            paddingBottom: 38,
            backgroundColor: '#fff',
          },
        }}>
        <BottomTab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            headerTitle: '',
            tabBarLabel: ({focused}) => (
              <BottomTabLabel focused={focused} label={'Home'} />
            ),
            tabBarIcon: ({color, focused}) => (
              <BottomTabIcon
                icon={<RcIconNavigationHomeLight isActive={focused} />}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Dapps"
          component={SampleScreen}
          options={{
            title: 'Dapps',
            headerTitle: '',
            tabBarLabel: ({focused}) => (
              <BottomTabLabel focused={focused} label={'Dapps'} />
            ),
            tabBarIcon: ({color, focused}) => (
              <BottomTabIcon
                icon={<RcIconNavigationDappsLight isActive={focused} />}
              />
            ),
          }}
        />
      </BottomTab.Navigator>
    </>
  );
};

// const SettingNavigator = () => {
//   const screenOptions = useStackScreenConfig();
//   const colors = useThemeColors();
//   // console.log('============== SettingNavigator Render =========');

//   return (
//     <SettingsStack.Navigator
//       screenOptions={{
//         ...screenOptions,
//         gestureEnabled: false,
//       }}>

//       </SettingsStack.Navigator>
//   );
// };

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    tabItem: {
      position: 'relative',
    },
    tabBarLabelStyle: {
      fontSize: 11,
      width: '100%',
      paddingTop: 6,
      fontWeight: '600',
      textAlign: 'center',
      color: colors['blue-default'],
      // fontFamily: 'SF Pro',
    },
    leftTitle: {
      marginLeft: 8,
      fontSize: 25,
      fontWeight: '700',
    },
  });
