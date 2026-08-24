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
  [RootNames.StackTransaction]: RootNames.StackTransaction,
  [RootNames.SingleAddressStack]: RootNames.SingleAddressStack,
};

async function preloadNamedComponent(
  name?: string,
  { allowInDev = false }: { allowInDev?: boolean } = {},
) {
  if (
    (__DEV__ && !allowInDev) ||
    loadablesAreEager ||
    !name ||
    isCached(name)
  ) {
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

/**
 * Resolve the lazy TransactionNavigator before an explicit Perps route push.
 *
 * General startup preloads remain disabled in development, but entering Perps
 * must not transition to bundle-splitter's null Suspense fallback while the
 * shared navigator is still loading.
 */
export async function prepareTransactionNavigatorForPerpsNavigation() {
  await preloadNamedComponent(PRELOAD_NAVIGATORS[RootNames.StackTransaction], {
    allowInDev: true,
  });
}

export async function preloadSingleAddressNavigator() {
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
