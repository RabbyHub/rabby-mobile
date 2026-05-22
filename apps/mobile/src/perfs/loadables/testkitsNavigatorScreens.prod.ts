import { registerAppScreen } from '@/perfs/apis';
import { TESTKITS_PRELOAD_SCREENS } from '@/perfs/preloads';

export const DevUIAnimatedTextAndView = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIAnimatedTextAndView').default
>({
  loader: () => import('@/screens/Testkits/DevUIAnimatedTextAndView'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIAnimatedTextAndView,
});

export const DevUIFontShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFontShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFontShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIFontShowCase,
});

export const DevUIFormShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIFormShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIFormShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIFormShowCase,
});

export const DevUIAccountShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIAccountShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIAccountShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIAccountShowCase,
});

export const DevUIComponents2024ShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIComponents2024ShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIComponents2024ShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIComponents2024ShowCase,
});

export const DevUIToast = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIToast').default
>({
  loader: () => import('@/screens/Testkits/DevUIToast'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIToast,
});

export const DevUINotifications = registerAppScreen<
  typeof import('@/screens/Testkits/DevUINotifications').default
>({
  loader: () => import('@/screens/Testkits/DevUINotifications'),
  name: TESTKITS_PRELOAD_SCREENS.DevUINotifications,
});

export const DevUIScreenContainerShowCase = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIScreenContainerShowCase').default
>({
  loader: () => import('@/screens/Testkits/DevUIScreenContainerShowCase'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIScreenContainerShowCase,
});

export const DevUIDapps = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIDapps').default
>({
  loader: () => import('@/screens/Testkits/DevUIDapps'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIDapps,
});

export const DevUIBuiltInPages = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIBuiltInPages').default
>({
  loader: () => import('@/screens/Testkits/DevUIBuiltInPages'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIBuiltInPages,
});

export const DevUIPermissions = registerAppScreen<
  typeof import('@/screens/Testkits/DevUIPermissions').default
>({
  loader: () => import('@/screens/Testkits/DevUIPermissions'),
  name: TESTKITS_PRELOAD_SCREENS.DevUIPermissions,
});

export const DevCapabilityFile = registerAppScreen<
  typeof import('@/screens/Testkits/DevCapabilityFile').default
>({
  loader: () => import('@/screens/Testkits/DevCapabilityFile'),
  name: TESTKITS_PRELOAD_SCREENS.DevCapabilityFile,
});

export const DevDataSQLite = registerAppScreen<
  typeof import('@/screens/Testkits/DevDataSQLite').default
>({
  loader: () => import('@/screens/Testkits/DevDataSQLite'),
  name: TESTKITS_PRELOAD_SCREENS.DevDataSQLite,
});

export const DevDataKeychain = registerAppScreen<
  typeof import('@/screens/Testkits/DevDataKeychain').default
>({
  loader: () => import('@/screens/Testkits/DevDataKeychain'),
  name: TESTKITS_PRELOAD_SCREENS.DevDataKeychain,
});

export const DevDataContactService = registerAppScreen<
  typeof import('@/screens/Testkits/DevDataContactService').default
>({
  loader: () => import('@/screens/Testkits/DevDataContactService'),
  name: TESTKITS_PRELOAD_SCREENS.DevDataContactService,
});

export const DevDataWhitelist = registerAppScreen<
  typeof import('@/screens/Testkits/DevDataWhitelist').default
>({
  loader: () => import('@/screens/Testkits/DevDataWhitelist'),
  name: TESTKITS_PRELOAD_SCREENS.DevDataWhitelist,
});

export const DevSwitches = registerAppScreen<
  typeof import('@/screens/Testkits/DevSwitches').default
>({
  loader: () => import('@/screens/Testkits/DevSwitches'),
  name: TESTKITS_PRELOAD_SCREENS.DevSwitches,
});

export const DevPerf = registerAppScreen<
  typeof import('@/screens/Testkits/DevPerf').default
>({
  loader: () => import('@/screens/Testkits/DevPerf'),
  name: TESTKITS_PRELOAD_SCREENS.DevPerf,
});

export const DebugLogViewer = registerAppScreen<
  typeof import('@/screens/Testkits/DebugLogViewer').default
>({
  loader: () => import('@/screens/Testkits/DebugLogViewer'),
  name: TESTKITS_PRELOAD_SCREENS.DebugLogViewer,
});
