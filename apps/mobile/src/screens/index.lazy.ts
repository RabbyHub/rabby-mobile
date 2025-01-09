import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';
import { PRELOAD_SCREENS } from '@/perfs/preloads';

export const ScannerScreen = registerAppScreen<
  typeof import('@/screens/Scanner/ScannerScreen').ScannerScreen
>({
  loader: () =>
    import('@/screens/Scanner/ScannerScreen').then(m => m.ScannerScreen),
  name: RootNames.Scanner,
});
export const UnlockScreen = registerAppScreen<
  typeof import('@/screens/Unlock/Unlock').default
>({
  loader: () => import('@/screens/Unlock/Unlock'),
  name: RootNames.Unlock,
});
export const FavoriteDappsScreen = registerAppScreen<
  typeof import('@/screens/Dapps/FavoriteDappsScreen').FavoriteDappsScreen
>({
  loader: () =>
    import('@/screens/Dapps/FavoriteDappsScreen').then(
      m => m.FavoriteDappsScreen,
    ),
  name: RootNames.FavoriteDapps,
});
export const TokenDetailScreen = registerAppScreen<
  typeof import('@/screens/TokenDetail').TokenDetailScreen
>({
  loader: () => import('@/screens/TokenDetail').then(m => m.TokenDetailScreen),
  name: RootNames.TokenDetail,
});
export const NFTDetailScreen = registerAppScreen<
  typeof import('@/screens/NftDetail').NFTDetailScreen
>({
  loader: () => import('@/screens/NftDetail').then(m => m.NFTDetailScreen),
  name: RootNames.NftDetail,
});
export const DeFiDetailScreen = registerAppScreen<
  typeof import('@/screens/DeFiDetail').DeFiDetailScreen
>({
  loader: () => import('@/screens/DeFiDetail').then(m => m.DeFiDetailScreen),
  name: RootNames.DeFiDetail,
});
export const NotFoundScreen = registerAppScreen<
  typeof import('@/screens/NotFound').default
>({
  loader: () => import('@/screens/NotFound'),
  name: RootNames.NotFound,
});
export const MyBundleScreen = registerAppScreen<
  typeof import('@/screens/Assets/MyBundle').default
>({
  loader: () => import('@/screens/Assets/MyBundle'),
  name: RootNames.MyBundle,
});

export const SettingsScreen = registerAppScreen<
  typeof import('@/screens/Settings/Settings').default
>({
  loader: () => import('@/screens/Settings/Settings'),
  name: PRELOAD_SCREENS[RootNames.Settings],
});
