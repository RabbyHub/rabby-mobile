import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { StyleSheet } from 'react-native';
import { DappCardList } from '../components/DappCardList';

export function FavoriteDappsScreen(): JSX.Element {
  const { styles } = useThemeStyles(getStyles);
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { favoriteApps } = useDappsHome();

  React.useEffect(() => {
    const title = `Favorites（${favoriteApps.length}）`;
    setNavigationOptions({
      headerTitle: title,
      title,
    });
  }, [setNavigationOptions, favoriteApps.length]);

  return (
    <NormalScreenContainer overwriteStyle={styles.page}>
      <DappCardList data={favoriteApps} />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {
      // todo
      backgroundColor: '#fff',
    },
  });
