import { RootNames } from '@/constant/layout';

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
  [RootNames.SingleAddressHome]: 'SingleAddressHomeScreen',
};

export const PRELOAD_NAVIGATORS = {
  [RootNames.StackSettings]: RootNames.StackSettings,
  [RootNames.StackTransaction]: RootNames.StackTransaction,
  [RootNames.SingleAddressStack]: RootNames.SingleAddressStack,
};
