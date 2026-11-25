import { withScreenPropsInjection } from '@/devtools/screenRegistry/screenInjection';
import 'react-native-gesture-handler';
import { RootNames } from '@/constant/layout';
import DevScreenInjectionProbe from '@/screens/Testkits/DevScreenInjectionProbe';
import DevTabsHost from '@/screens/Testkits/DevTabsHost';
import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DebugLogViewer,
  StartupPerformanceLogViewer,
  DevCapabilityFile,
  InMemoryLogViewer,
  DevDataContactService,
  DevDataSQLite,
  DevWatchAddressFixtureImport,
  DevDataKeychain,
  DevDataKeyringVault,
  DevDataWhitelist,
  DevPerf,
  DevSwitches,
  DevUIAccountShowCase,
  DevUIAnimatedTextAndView,
  DevUIAutoFitTitlePlayground,
  DevUIBuiltInPages,
  DevUIComponents2024ShowCase,
  DevUISwipableSubScreen,
  DevUIRootSubScreen,
  DevUIWalletConnect,
  DevUIDapps,
  DevUIFontShowCase,
  DevUIFormShowCase,
  DevUINotifications,
  DevUIPermissions,
  DevUISafeSvgMedia,
  DevUIScreenContainerShowCase,
  DevUIToast,
} from '@/perfs/loadables/testkitsNavigatorScreens';

const Stack = createNativeStackNavigator();

// devOnlyDelayNavi(
//   ({ naviPush, RootNames }) => {
//     naviPush(RootNames.StackTestkits, {
//       screen: RootNames.DevDataSQLite,
//     });
//   },
//   { timeout: 5 * 1e3 },
// );

export function TestkitsNavigator() {
  const { mergeScreenOptions2024 } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== TestkitsNavigator Render =========');

  // useLayoutEffect(() => {
  //   preloadNonProductionScreens();
  // }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarBackgroundColor: colors['blue-default'],
      }}>
      <Stack.Screen
        name={RootNames.DevUIAnimatedTextAndView}
        component={withScreenPropsInjection(DevUIAnimatedTextAndView)}
      />
      <Stack.Screen
        name={RootNames.DevUIAutoFitTitlePlayground}
        component={withScreenPropsInjection(DevUIAutoFitTitlePlayground)}
      />
      <Stack.Screen
        name={RootNames.DevUIFontShowCase}
        component={withScreenPropsInjection(DevUIFontShowCase)}
      />
      <Stack.Screen
        name={RootNames.DevUIFormShowCase}
        component={withScreenPropsInjection(DevUIFormShowCase)}
      />
      <Stack.Screen
        name={RootNames.DevUIAccountShowCase}
        component={withScreenPropsInjection(DevUIAccountShowCase)}
      />
      <Stack.Screen
        name={RootNames.DevUIComponents2024ShowCase}
        component={withScreenPropsInjection(DevUIComponents2024ShowCase)}
      />
      <Stack.Screen
        name={RootNames.DevUISwipableSubScreen}
        component={DevUISwipableSubScreen}
      />
      <Stack.Screen
        name={RootNames.DevUIRootSubScreen}
        component={DevUIRootSubScreen}
      />
      <Stack.Screen
        name={RootNames.DevUISafeSvgMedia}
        component={withScreenPropsInjection(DevUISafeSvgMedia)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Safe SVG Media',
            title: 'Safe SVG Media',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevUIScreenContainerShowCase}
        component={withScreenPropsInjection(DevUIScreenContainerShowCase)}
      />
      <Stack.Screen
        name={RootNames.DevUIToast}
        component={withScreenPropsInjection(DevUIToast)}
      />
      <Stack.Screen
        name={RootNames.DevUINotifications}
        component={withScreenPropsInjection(DevUINotifications)}
      />
      <Stack.Screen
        name={RootNames.DevUIDapps}
        component={withScreenPropsInjection(DevUIDapps)}
      />
      <Stack.Screen
        name={RootNames.DevUIBuiltInPages}
        component={withScreenPropsInjection(DevUIBuiltInPages)}
      />
      <Stack.Screen
        name={RootNames.DevUIPermissions}
        component={withScreenPropsInjection(DevUIPermissions)}
      />
      <Stack.Screen
        name={RootNames.DevUIWalletConnect}
        component={withScreenPropsInjection(DevUIWalletConnect)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'WalletConnect Log',
            title: 'WalletConnect Log',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevCapabilityFile}
        component={withScreenPropsInjection(DevCapabilityFile)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'File Capability',
            title: 'File Capability',
          },
        ])}
      />

      <Stack.Screen
        name={RootNames.DevDataSQLite}
        component={withScreenPropsInjection(DevDataSQLite)}
      />
      <Stack.Screen
        name={RootNames.DevWatchAddressFixtureImport}
        component={withScreenPropsInjection(DevWatchAddressFixtureImport)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Benchmark Watch addresses',
            title: 'Benchmark Watch addresses',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevDataKeychain}
        component={withScreenPropsInjection(DevDataKeychain)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Keychain Data',
            title: 'Keychain Data',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevDataKeyringVault}
        component={withScreenPropsInjection(DevDataKeyringVault)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Keyring Vault',
            title: 'Keyring Vault',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevDataContactService}
        component={withScreenPropsInjection(DevDataContactService)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Contact Service',
            title: 'Contact Service',
          },
        ])}
      />
      <Stack.Screen
        name={RootNames.DevDataWhitelist}
        component={withScreenPropsInjection(DevDataWhitelist)}
        options={mergeScreenOptions2024([
          {
            headerShown: true,
            headerTitle: 'Whitelist Data',
            title: 'Whitelist Data',
          },
        ])}
      />

      <Stack.Screen
        name={RootNames.DevSwitches}
        component={withScreenPropsInjection(DevSwitches)}
        options={{
          headerShown: true,
          // presentation: 'modal',
        }}
      />
      <Stack.Screen
        name={RootNames.DevScreenInjectionProbe}
        component={withScreenPropsInjection(DevScreenInjectionProbe)}
        options={{
          headerShown: true,
          title: 'Screen Injection Probe',
        }}
      />
      <Stack.Screen
        name={RootNames.DevTabsHost}
        component={withScreenPropsInjection(DevTabsHost as any)}
        options={{
          headerShown: true,
          title: 'Tabs Host',
        }}
      />
      <Stack.Screen
        name={RootNames.DevPerf}
        component={withScreenPropsInjection(DevPerf)}
        options={{
          headerShown: true,
          // presentation: 'modal',
        }}
      />
      <Stack.Screen
        name={RootNames.DebugLogViewer}
        component={withScreenPropsInjection(DebugLogViewer)}
        options={{
          headerShown: true,
          title: 'App Log Verification',
        }}
      />
      <Stack.Screen
        name={RootNames.StartupPerformanceLogViewer}
        component={withScreenPropsInjection(StartupPerformanceLogViewer)}
        options={{
          headerShown: true,
          title: 'Startup Performance Logs',
        }}
      />
      <Stack.Screen
        name={RootNames.InMemoryLogViewer}
        component={withScreenPropsInjection(InMemoryLogViewer)}
        options={{
          headerShown: true,
          title: 'In-Memory Logs',
        }}
      />
    </Stack.Navigator>
  );
}
