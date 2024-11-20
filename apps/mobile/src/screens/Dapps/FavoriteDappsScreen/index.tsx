import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn } from 'ahooks';
import { DappCardList } from '../components/DappCardList';
import { useOpenDappView } from '../hooks/useDappView';
import LinearGradient from 'react-native-linear-gradient';

export function FavoriteDappsScreen(): JSX.Element {
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { favoriteApps } = useDappsHome();

  React.useEffect(() => {
    const title = `Favorites（${favoriteApps.length}）`;
    setNavigationOptions({
      headerTitle: title,
      title,
    });
  }, [setNavigationOptions, favoriteApps.length]);

  const { setBrowserHistory, setDapp } = useDappsHome();
  const { openUrlAsDapp } = useOpenDappView();

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  const handleOpenURL = useMemoizedFn((url: string) => {
    openUrlAsDapp(url, {
      showSheetModalFirst: true,
    });
    setBrowserHistory(safeGetOrigin(url));
  });

  const handleFavoriteDapp = useMemoizedFn((dapp: DappInfo) => {
    setDapp({
      ...dapp,
      isFavorite: !dapp.isFavorite,
    });
  });

  return (
    <LinearGradient
      colors={
        isLight
          ? ['#fff', '#F9F9F9']
          : [colors2024['neutral-bg-2'], colors2024['neutral-bg-2']]
      }
      start={{ x: 0, y: 0.0728 }}
      end={{ x: 0, y: 0.1614 }}>
      <NormalScreenContainer overwriteStyle={styles.page}>
        <DappCardList
          data={favoriteApps}
          onFavoritePress={handleFavoriteDapp}
          onPress={dapp => {
            handleOpenURL(dapp.origin);
          }}
        />
      </NormalScreenContainer>
    </LinearGradient>
  );
}

const getStyle = createGetStyles2024(() => ({
  page: {
    backgroundColor: 'transparent',
  },
}));
