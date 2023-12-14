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

  const [data, setData] = useState<Record<string, DappInfo>>({});

  useEffect(() => {
    // const dapps = dappService.getDapps();
    const dapps = {};
    setData(dapps);
  }, [setData]);

  const sections = useMemo(() => {
    const list = Object.values(data || {});
    if (!list.length) {
      return [];
    }
    const otherList: DappInfo[] = [];
    const favoriteList: DappInfo[] = [];
    list.forEach(item => {
      if (item.isFavorite) {
        favoriteList.push(item);
      } else {
        otherList.push(item);
      }
    });
    return [
      {
        title: '',
        data: otherList,
      },
      {
        title: 'Favorite',
        data: favoriteList,
      },
    ];
  }, [data]);

  return (
    <NormalScreenContainer style={styles.container}>
      <DappCardList sections={sections} />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      paddingVertical: 20,
      backgroundColor: colors['neutral-bg-2'],
    },
    navRight: {
      marginRight: 20,
    },
    searchIcon: {
      color: colors['neutral-body'],
    },
  });
