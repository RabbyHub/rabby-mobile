import { isNonPublicProductionEnv } from '@/constant';
import { AppRootName, RootNames } from '@/constant/layout';
import { isCached, preload } from 'react-native-bundle-splitter';

const loadablesAreEager =
  process.env.RABBY_MOBILE_MODULE_LOADING_MODE === 'eager';
const pendingNamedComponentPreloads = new Map<string, Promise<void>>();

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
  [RootNames.SingleAddressHome]: 'SingleAddressHomeScreen',
};

export const PRELOAD_NAVIGATORS = {
  [RootNames.StackSettings]: RootNames.StackSettings,
  [RootNames.StackTransaction]: RootNames.StackTransaction,
  [RootNames.SingleAddressStack]: RootNames.SingleAddressStack,
};

async function preloadNamedComponent(name?: string) {
  if (__DEV__ || loadablesAreEager || !name || isCached(name)) {
    return;
  }

  const pendingPreload = pendingNamedComponentPreloads.get(name);
  if (pendingPreload) {
    await pendingPreload;
    return;
  }

  const preloadPromise = Promise.resolve(preload().component(name)).then(
    () => undefined,
  );
  pendingNamedComponentPreloads.set(name, preloadPromise);

  try {
    await preloadPromise;
  } finally {
    if (pendingNamedComponentPreloads.get(name) === preloadPromise) {
      pendingNamedComponentPreloads.delete(name);
    }
  }
}

function ensureSingleAddressScreenRegistration() {
  return import('@/perfs/loadables/singleAddressScreens').then(() => undefined);
}

export async function preloadSettingsScreen() {
  // SettingsScreen is registered by the lazy Settings navigator module. Load
  // that module first so the named screen is available to bundle-splitter.
  await preloadNamedComponent(PRELOAD_NAVIGATORS[RootNames.StackSettings]);
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
  // The root stack references SingleAddressNavigator directly, but its lazy
  // Home screen registration is not itself a named navigator preload. Ensure
  // the registration module has run before asking bundle-splitter for it.
  await ensureSingleAddressScreenRegistration();
  await preloadNamedComponent(PRELOAD_SCREENS[RootNames.SingleAddressHome]);
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
  [RootNames.DevUIWalletConnect]: 'DevUIWalletConnect',
  [RootNames.DevCapabilityFile]: 'DevCapabilityFile',
  [RootNames.DevUIBuiltInPages]: 'DevUIBuiltInPages',
  [RootNames.DevDataSQLite]: 'DevDataSQLite',
  [RootNames.DevDataKeychain]: 'DevDataKeychain',
  [RootNames.DevDataKeyringVault]: 'DevDataKeyringVault',
  [RootNames.DevDataContactService]: 'DevDataContactService',
  [RootNames.DevDataWhitelist]: 'DevDataWhitelist',
  [RootNames.DevSwitches]: 'DevSwitches',
  [RootNames.DevPerf]: 'DevPerf',
  [RootNames.DebugLogViewer]: 'DebugLogViewer',
  [RootNames.StartupPerformanceLogViewer]: 'StartupPerformanceLogViewer',
  [RootNames.InMemoryLogViewer]: 'InMemoryLogViewer',
};

export async function preloadNonProductionScreens() {
  if (!isNonPublicProductionEnv || loadablesAreEager) {
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
