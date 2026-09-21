import { RootNames } from '@/constant/layout';
import { registerAppScreen } from '@/perfs/apis';

export const SearchScreen = registerAppScreen<
  typeof import('@/screens/Search').default
>({
  loader: () => import('@/screens/Search'),
  name: RootNames.Search,
});

export const WatchlistScreen = registerAppScreen<
  typeof import('@/screens/Watchlist').default
>({
  loader: () => import('@/screens/Watchlist'),
  name: RootNames.Watchlist,
});

export const MemeScreen = registerAppScreen<
  typeof import('@/screens/Meme').default
>({
  loader: () => import('@/screens/Meme'),
  name: RootNames.Meme,
});

export const MarketScreen = registerAppScreen<
  typeof import('@/screens/Market').default
>({
  loader: () => import('@/screens/Market'),
  name: RootNames.Market,
});
