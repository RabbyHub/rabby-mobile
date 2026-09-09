import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';

export const AddressNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/AddressNavigator').AddressNavigator
>({
  loader: () =>
    import('@/screens/Navigators/AddressNavigator').then(m => ({
      default: m.AddressNavigator,
    })),
  name: RootNames.StackAddress,
});

export const SettingNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/SettingsNavigator').SettingNavigator
>({
  loader: () =>
    import('@/screens/Navigators/SettingsNavigator').then(m => ({
      default: m.SettingNavigator,
    })),
  name: RootNames.StackSettings,
});

export const TestkitsNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/TestkitsNavigator').TestkitsNavigator
>({
  loader: () =>
    import('@/screens/Navigators/TestkitsNavigator').then(m => ({
      default: m.TestkitsNavigator,
    })),
  name: RootNames.StackTestkits,
});

export const TransactionNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/TransactionNavigator').default
>({
  loader: () => import('@/screens/Navigators/TransactionNavigator'),
  name: RootNames.StackTransaction,
});

export const DappsNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/DappsNavigator').DappsNavigator
>({
  loader: () =>
    import('@/screens/Navigators/DappsNavigator').then(m => ({
      default: m.DappsNavigator,
    })),
  name: RootNames.StackDapps,
});

export const HomeNonTabNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/HomeNonTabNavigator').default
>({
  loader: () => import('@/screens/Navigators/HomeNonTabNavigator'),
  name: RootNames.StackHomeNonTab,
});
