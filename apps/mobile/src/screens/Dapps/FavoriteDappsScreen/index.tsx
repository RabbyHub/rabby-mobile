import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { useMemoizedFn } from 'ahooks';
import { StyleSheet } from 'react-native';
import { DappCardList } from '../components/DappCardList';

export function FavoriteDappsScreen(): JSX.Element {
  const { styles } = useThemeStyles(getStyles);
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { favoriteApps } = useDappsHome();

  const getHeaderTitle = useMemoizedFn(() => {
    return (
      <HeaderTitleText>Favorites（{favoriteApps.length}）</HeaderTitleText>
    );
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  return (
    <NormalScreenContainer style={styles.page}>
      <DappCardList data={favoriteApps} />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {},
  });
