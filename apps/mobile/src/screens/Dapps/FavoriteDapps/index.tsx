import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useEffect, useMemo } from 'react';

import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappInfo } from '@/core/services/dappService';
import { useNavigation } from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import { StyleSheet, View } from 'react-native';
import { FavoriteDappCardList } from './components/FavoriteDappCardList';
import { openapi } from '@/core/request';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { DappCardList } from '../Dapps/components/DappCardList';
import { useDappsHome } from '@/hooks/useDappsHome';

export function FavoriteDappsScreen(): JSX.Element {
  const { styles } = useThemeStyles(getStyles);
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { favoriteApps } = useDappsHome();

  const getHeaderTitle = useMemoizedFn(() => {
    return (
      <HeaderTitleText>Favorites（{favoriteApps.length}）</HeaderTitleText>
    );
  });

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
