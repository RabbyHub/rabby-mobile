import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useEffect, useMemo } from 'react';

import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { useNavigation } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import { StyleSheet, View } from 'react-native';
import { FavoriteDappCardList } from './components/FavoriteDappCardList';
import { openapi } from '@/core/request';
import { FooterButton } from '@/components/FooterButton/FooterButton';

export function FavoritePopularDappsScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const getHeaderTitle = React.useCallback(() => {
    return <HeaderTitleText>Explore Popular Dapp</HeaderTitleText>;
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: getHeaderTitle,
    });
  }, [navigation, getHeaderTitle]);

  const { data } = useRequest(async () => {
    return openapi.getHotDapps();
  });

  const [selectDapps, setSelectDapps] = React.useState<string[]>([]);

  const { dapps, addDapp } = useDapps();

  useEffect(() => {
    setSelectDapps(
      Object.values(dapps)
        .filter(item => item.isFavorite)
        .map(item => item.info.id),
    );
  }, [dapps]);

  const list = useMemo(() => {
    return (data || []).map(info => {
      const local = dapps[info.id];
      return {
        ...local,
        info: info as DappInfo['info'],
        isFavorite: selectDapps.includes(info.id),
      };
    });
  }, [dapps, data, selectDapps]);

  const handleFavorite = useCallback(() => {
    addDapp(list.filter(item => item.isFavorite));
    navigation.goBack();
  }, [addDapp, list, navigation]);

  console.log({
    dapps,
  });

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <FavoriteDappCardList
          data={list}
          onPress={dapp => {
            if (selectDapps.includes(dapp.info.id)) {
              setSelectDapps(prev =>
                prev.filter(item => item !== dapp.info.id),
              );
            } else {
              setSelectDapps(prev => [...prev, dapp.info.id]);
            }
          }}
        />
      </View>
      <FooterButton
        width={248}
        onPress={handleFavorite}
        title={'Add to Favorites'}
      />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {
      backgroundColor: colors['neutral-bg-2'],
      flexDirection: 'column',
      gap: 8,
    },
    container: {
      flex: 1,
      paddingTop: 10,
    },
  });
