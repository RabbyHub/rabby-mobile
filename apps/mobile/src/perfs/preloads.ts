import { isNonPublicProductionEnv } from '@/constant';
import { AppRootName, RootNames } from '@/constant/layout';
import { isCached, preload } from 'react-native-bundle-splitter';

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
};

export const PRELOAD_NAVIGATORS = {
  [RootNames.StackTransaction]: RootNames.StackTransaction,
  [RootNames.SingleAddressStack]: RootNames.SingleAddressStack,
};

async function preloadNamedComponent(name?: string) {
  if (__DEV__ || !name || isCached(name)) {
    return;
  }

  await preload().component(name);
}

export async function preloadSettingsScreen() {
  await preloadNamedComponent(PRELOAD_SCREENS[RootNames.Settings]);
}

export async function preloadHomeEntryNavigator() {
  return;
}

export async function preloadTransactionHotNavigator() {
  // Send / Swap / Bridge currently live under TransactionNavigator.
  await preloadNamedComponent(PRELOAD_NAVIGATORS[RootNames.StackTransaction]);
}

export async function preloadSingleAddressNavigator() {
  await preloadNamedComponent(PRELOAD_NAVIGATORS[RootNames.SingleAddressStack]);
}

export async function preloadHomeShortcutNavigators() {
  await Promise.all([preloadSettingsScreen(), preloadSingleAddressNavigator()]);
}

export const TESTKITS_PRELOAD_SCREENS: { [P in AppRootName]?: P } = {
  [RootNames.DevUIFontShowCase]: 'DevUIFontShowCase',
  [RootNames.DevUIAnimatedTextAndView]: 'DevUIAnimatedTextAndView',
  [RootNames.DevUIFormShowCase]: 'DevUIFormShowCase',
  [RootNames.DevUIAccountShowCase]: 'DevUIAccountShowCase',
  [RootNames.DevUIComponents2024ShowCase]: 'DevUIComponents2024ShowCase',
  [RootNames.DevUIScreenContainerShowCase]: 'DevUIScreenContainerShowCase',
  [RootNames.DevUIToast]: 'DevUIToast',
  [RootNames.DevUINotifications]: 'DevUINotifications',
  [RootNames.DevUIDapps]: 'DevUIDapps',
  [RootNames.DevUIPermissions]: 'DevUIPermissions',
  [RootNames.DevUIBuiltInPages]: 'DevUIBuiltInPages',
  [RootNames.DevDataSQLite]: 'DevDataSQLite',
  [RootNames.DevDataWhitelist]: 'DevDataWhitelist',
  [RootNames.DevSwitches]: 'DevSwitches',
  [RootNames.DevPerf]: 'DevPerf',
  [RootNames.DebugLogViewer]: 'DebugLogViewer',
};

export async function preloadNonProductionScreens() {
  if (!isNonPublicProductionEnv) {
    return;
  }

  console.debug('Preloading non-production screens');

  return Promise.all(
    Object.values(TESTKITS_PRELOAD_SCREENS).map(screen => {
      if (isCached(screen)) {
        console.debug('Screen already cached --- %s', screen);
        return;
      }

      console.debug('Preloading non-production screen --- %s', screen);

      return preload().component(screen);
    }),
  );
}

// export const NON_PROD_NAVIGATORS = {
//   [RootNames.StackTestkits]: RootNames.StackTestkits,
// };

// async function preloadNonProductionNavigators() {
//   if (!isNonPublicProductionEnv) return ;

//   console.debug('Preloading non-production navigators:');

//   return Promise.all(
//     Object.values(NON_PROD_NAVIGATORS).map((navigator) => {
//       if (isCached(navigator)) return;

//       console.debug('Preloading non-production navigator --- %s', navigator);
//       return preload().component(navigator);
//     }),
//   )/* .then(() => preloadNonProductionScreens()) */;
// }

// export function usePreloadNonProductionNavigators() {
//   useLayoutEffect(() => {
//     preloadNonProductionNavigators();
//   }, []);
// }
