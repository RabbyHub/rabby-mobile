import React, { useMemo } from 'react';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import type { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn } from 'ahooks';
import { DappCardList } from '../components/DappCardList';
import { useDappWebViewScreen } from '../hooks/useDappWebViewScreen';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import LinearGradient from 'react-native-linear-gradient';
import { debounce } from 'lodash';
import { RootNames } from '@/constant/layout';
import { Text } from '@/components/Typography';
import { withBrowserDappServices } from '@/hooks/browser/browserServiceDependencies';

/**
 * Route-level header title for the favourites list.
 *
 * Declared on the route (`headerTitle: () => <FavoriteDappsHeaderTitle />`)
 * so the native header renders the final title from the first frame; the old
 * effect installed it after mount, which swapped the header mid-transition.
 */
export function FavoriteDappsHeaderTitle() {
  const { favoriteApps } = useDappsHome();
  const { styles } = useTheme2024({ getStyle });

  return <Text style={styles.title}>Favorites（{favoriteApps.length}）</Text>;
}

function FavoriteDappsScreenContent(): JSX.Element {
  const { favoriteApps, setBrowserHistory, updateFavorite } = useDappsHome();
  const { openUrlAsDapp } = useDappWebViewScreen();

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  type OpenUrlAsDappOptions = Pick<
    Parameters<typeof openUrlAsDapp>[1] & object,
    'forceReopen'
  >;
  const handleOpenURL = useMemoizedFn(
    (url: string, options?: OpenUrlAsDappOptions) => {
      void openUrlAsDapp(url, {
        ...options,
        dappsWebViewFromRoute: RootNames.FavoriteDapps,
      }).catch(console.error);
      // @ts-expect-error code has been expired due to biz changes, whole file could be removed later
      setBrowserHistory(safeGetOrigin(url));
    },
  );

  const handleFavoriteDapp = useMemoizedFn((dapp: DappInfo) => {
    updateFavorite(dapp.origin, !dapp.isFavorite);
  });

  const handleOpenURLDebounced = useMemo(() => {
    return debounce((dapp: DappInfo) => {
      handleOpenURL(dapp.origin);
    }, 200);
  }, [handleOpenURL]);

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      start={{ x: 0, y: 0.0728 }}
      end={{ x: 0, y: 0.1614 }}>
      <NormalScreenContainer overwriteStyle={styles.page}>
        <DappCardList
          data={favoriteApps}
          onFavoritePress={handleFavoriteDapp}
          onPress={handleOpenURLDebounced}
        />
      </NormalScreenContainer>
    </LinearGradient>
  );
}

export const FavoriteDappsScreen = withBrowserDappServices(
  FavoriteDappsScreenContent,
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    backgroundColor: 'transparent',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
}));
