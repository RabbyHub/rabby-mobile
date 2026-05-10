import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';

export { AddressNavigator } from '@/screens/Navigators/AddressNavigator';
export { SettingNavigator } from '@/screens/Navigators/SettingsNavigator';

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

export const SingleAddressNavigator = registerAppScreen<
  typeof import('@/screens/Navigators/SingleAddressNavigator').SingleAddressNavigator
>({
  loader: () =>
    import('@/screens/Navigators/SingleAddressNavigator').then(m => ({
      default: m.SingleAddressNavigator,
    })),
  name: RootNames.SingleAddressStack,
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
