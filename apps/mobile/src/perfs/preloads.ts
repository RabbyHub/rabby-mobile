import { isNonPublicProductionEnv } from '@/constant';
import { AppRootName, RootNames } from '@/constant/layout';
import { isCached, preload } from 'react-native-bundle-splitter';

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
};

export async function preloadSettingsScreen() {
  if (isCached(PRELOAD_SCREENS[RootNames.Settings])) return;

  await preload().component(PRELOAD_SCREENS[RootNames.Settings]);
}

export const TESTKITS_PRELOAD_SCREENS: { [P in AppRootName]?: P } = {
  [RootNames.NewUserGetStarted2024]: 'NewUserGetStarted2024',
  [RootNames.DevUIFontShowCase]: 'DevUIFontShowCase',
  [RootNames.DevUIAnimatedTextAndView]: 'DevUIAnimatedTextAndView',
  [RootNames.DevUIFormShowCase]: 'DevUIFormShowCase',
  [RootNames.DevUIAccountShowCase]: 'DevUIAccountShowCase',
  [RootNames.DevUIScreenContainerShowCase]: 'DevUIScreenContainerShowCase',
  [RootNames.DevUIDapps]: 'DevUIDapps',
  [RootNames.DevUIPermissions]: 'DevUIPermissions',
  [RootNames.DevUIBuiltInPages]: 'DevUIBuiltInPages',
  [RootNames.DevDataSQLite]: 'DevDataSQLite',
  [RootNames.DevSwitches]: 'DevSwitches',
  [RootNames.DevPerf]: 'DevPerf',
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
