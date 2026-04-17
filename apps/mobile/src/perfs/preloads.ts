import { isNonPublicProductionEnv } from '@/constant/package';
import { AppRootName, RootNames } from '@/constant/layout';
import { isCached, preload } from 'react-native-bundle-splitter';

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
};

export const PRELOAD_NAVIGATORS = {
  [RootNames.StackTransaction]: RootNames.StackTransaction,
  [RootNames.SingleAddressStack]: RootNames.SingleAddressStack,
};

type SharedPreloadOptions = {
  enabled?: boolean;
};

type SharedPreloadScheduleOptions = SharedPreloadOptions & {
  afterFrame?: boolean;
  delayMs?: number;
};

type SharedComponentPreloader = {
  preload: (trigger?: string, options?: SharedPreloadOptions) => Promise<void>;
  schedule: (
    trigger?: string,
    options?: SharedPreloadScheduleOptions,
  ) => () => void;
};

const noopCleanup = () => {};

// Multiple routes can request the same warm-path preload. We only want to pay
// the actual bundle-splitter cost once per app session.
function createSharedComponentPreloader(
  componentName: string | undefined,
  errorLabel: string,
): SharedComponentPreloader {
  let sharedPromise: Promise<void> | null = null;

  const shouldSkip = (enabled = true) =>
    !enabled || __DEV__ || !componentName || isCached(componentName);

  const preloadComponent: SharedComponentPreloader['preload'] = async (
    _trigger = errorLabel,
    options,
  ) => {
    if (shouldSkip(options?.enabled)) {
      return;
    }

    if (sharedPromise) {
      return sharedPromise;
    }

    const targetComponentName = componentName;
    if (!targetComponentName) {
      return;
    }

    sharedPromise = preload()
      .component(targetComponentName)
      .then(() => undefined)
      .catch(error => {
        sharedPromise = null;
        throw error;
      });

    return sharedPromise;
  };

  const scheduleComponentPreload: SharedComponentPreloader['schedule'] = (
    trigger = errorLabel,
    options,
  ) => {
    if (shouldSkip(options?.enabled)) {
      return noopCleanup;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;

    const run = () => {
      timeoutId = setTimeout(() => {
        void preloadComponent(trigger, options).catch(error => {
          console.error(`${errorLabel}::${trigger}::error`, error);
        });
      }, options?.delayMs ?? 0);
    };

    if (options?.afterFrame) {
      frameId = requestAnimationFrame(run);
    } else {
      run();
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  };

  return {
    preload: preloadComponent,
    schedule: scheduleComponentPreload,
  };
}

const settingsScreenPreloader = createSharedComponentPreloader(
  PRELOAD_SCREENS[RootNames.Settings],
  'preloadSettingsScreen',
);

const transactionHotNavigatorPreloader = createSharedComponentPreloader(
  PRELOAD_NAVIGATORS[RootNames.StackTransaction],
  'preloadTransactionHotNavigator',
);

const singleAddressNavigatorPreloader = createSharedComponentPreloader(
  PRELOAD_NAVIGATORS[RootNames.SingleAddressStack],
  'preloadSingleAddressNavigator',
);

export const preloadSettingsScreen = settingsScreenPreloader.preload;
export const scheduleSettingsScreenPreload = settingsScreenPreloader.schedule;

export async function preloadHomeEntryNavigator() {
  return;
}

export const preloadTransactionHotNavigator =
  transactionHotNavigatorPreloader.preload;

export const scheduleTransactionHotNavigatorPreload =
  transactionHotNavigatorPreloader.schedule;

export const preloadSingleAddressNavigator =
  singleAddressNavigatorPreloader.preload;

export const scheduleSingleAddressNavigatorPreload =
  singleAddressNavigatorPreloader.schedule;

export function scheduleHomeShortcutNavigatorsPreload(
  trigger = 'home_shortcuts',
  options?: SharedPreloadScheduleOptions,
) {
  const cleanupFns = [
    scheduleSettingsScreenPreload(trigger, options),
    scheduleSingleAddressNavigatorPreload(trigger, options),
  ];

  return () => {
    cleanupFns.forEach(cleanup => cleanup());
  };
}

export async function preloadHomeShortcutNavigators() {
  await Promise.all([
    preloadSettingsScreen('home_shortcuts'),
    preloadSingleAddressNavigator('home_shortcuts'),
  ]);
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
  [RootNames.DevSwitches]: 'DevSwitches',
  [RootNames.DevPerf]: 'DevPerf',
  [RootNames.DebugLogViewer]: 'DebugLogViewer',
};

export async function preloadNonProductionScreens() {
  if (!isNonPublicProductionEnv) return;

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
