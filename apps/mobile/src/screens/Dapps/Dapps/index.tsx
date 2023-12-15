import React, { useEffect, useMemo, useState } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors } from '@/hooks/theme';
import { DappCard } from './components/DappCard';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { DappCardList } from './components/DappCardList';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { Colors } from '@/constant/theme';
// import { useRequest } from 'ahooks';
import { getDappList } from '@/core/apis/dapp';
import { dappService } from '@/core/services';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { useDapps } from '@/hooks/useDapps';

export function DappsScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const getHeaderTitle = React.useCallback(() => {
    return <HeaderTitleText>Dapps</HeaderTitleText>;
  }, []);

  const getHeaderRight = React.useCallback(() => {
    return (
      <TouchableItem
        onPress={() => {
          navigate(RootNames.StackSearchDapps);
        }}
        style={styles.navRight}>
        <RcIconSearch style={styles.searchIcon} />
      </TouchableItem>
    );
  }, [styles.navRight, styles.searchIcon]);

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
    });
  }, [navigation, getHeaderTitle, getHeaderRight]);

  const { dappSections, updateFavorite, removeDapp } = useDapps();

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <DappCardList
          sections={dappSections}
          onFavoritePress={dapp => {
            updateFavorite(dapp.info.id, !dapp.isFavorite);
          }}
          onRemovePress={dapp => {
            removeDapp(dapp.info.id);
          }}
        />
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    page: {
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      paddingTop: 10,
      paddingBottom: 60,
    },
    navRight: {
      marginRight: 20,
    },
    searchIcon: {
      color: colors['neutral-body'],
    },
  });
