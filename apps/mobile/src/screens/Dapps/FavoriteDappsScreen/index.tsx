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

  const { styles } = useTheme2024({
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
    <NormalScreenContainer overwriteStyle={styles.page}>
      <DappCardList
        data={favoriteApps}
        onFavoritePress={handleFavoriteDapp}
        onPress={dapp => {
          handleOpenURL(dapp.origin);
        }}
      />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(() => ({
  page: {
    // todo
    backgroundColor: '#fff',
  },
}));
