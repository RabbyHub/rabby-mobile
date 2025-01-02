import { RootNames } from '@/constant/layout';
import { isCached, preload } from 'react-native-bundle-splitter';

export const PRELOAD_SCREENS = {
  [RootNames.Settings]: 'SettingsScreen',
};

export async function preloadSettingsScreen() {
  if (isCached(PRELOAD_SCREENS[RootNames.Settings])) return;

  await preload().component(PRELOAD_SCREENS[RootNames.Settings]);
}
