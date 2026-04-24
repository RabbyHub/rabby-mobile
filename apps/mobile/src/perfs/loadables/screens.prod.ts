import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';

export const ScannerScreen = registerAppScreen<
  typeof import('@/screens/Scanner/ScannerScreen').ScannerScreen
>({
  loader: () =>
    import('@/screens/Scanner/ScannerScreen').then(m => ({
      default: m.ScannerScreen,
    })),
  name: RootNames.Scanner,
});
export const TokenDetailScreen = registerAppScreen<
  typeof import('@/screens/TokenDetail').TokenDetailScreen
>({
  loader: () =>
    import('@/screens/TokenDetail').then(m => ({
      default: m.TokenDetailScreen,
    })),
  name: RootNames.TokenDetail,
});
export const NFTDetailScreen = registerAppScreen<
  typeof import('@/screens/NftDetail').NFTDetailScreen
>({
  loader: () =>
    import('@/screens/NftDetail').then(m => ({
      default: m.NFTDetailScreen,
    })),
  name: RootNames.NftDetail,
});
export const TokenMarketInfoScreen = registerAppScreen<
  typeof import('@/screens/TokenDetail/TokenMarketInfoScreen').TokenMarketInfoScreen
>({
  loader: () =>
    import('@/screens/TokenDetail/TokenMarketInfoScreen').then(m => ({
      default: m.TokenMarketInfoScreen,
    })),
  name: RootNames.TokenMarketInfo,
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
