import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';
import { PRELOAD_SCREENS } from '@/perfs/preloads';

export const SettingsScreen = registerAppScreen<
  typeof import('@/screens/Settings/Settings').default
>({
  loader: () => import('@/screens/Settings/Settings'),
  name: PRELOAD_SCREENS[RootNames.Settings],
});

export const SetPasswordScreen = registerAppScreen<
  typeof import('@/screens/ManagePassword/SetPassword').default
>({
  loader: () => import('@/screens/ManagePassword/SetPassword'),
  name: RootNames.SetPassword,
});

export const ProviderControllerTester = registerAppScreen<
  typeof import('@/screens/ProviderControllerTester/ProviderControllerTester').default
>({
  loader: () =>
    import('@/screens/ProviderControllerTester/ProviderControllerTester'),
  name: RootNames.ProviderControllerTester,
});
