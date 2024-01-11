import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useMemo } from 'react';

import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { DappCardList } from './components/DappCardList';
// import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useDapps } from '@/hooks/useDapps';
import {
  useActiveDappView,
  useActiveDappViewSheetModalRefs,
} from '../hooks/useDappView';
import SheetDappWebView from './components/SheetDappWebView';

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

  const { updateFavorite, removeDapp, disconnectDapp, getDapps, favoriteApps } =
    useDapps();
  const { setActiveDapp, activeDapp } = useActiveDappView();
  const { toggleShowSheetModal } = useActiveDappViewSheetModalRefs();
  const dappSections = useMemo(() => {
    return [
      {
        title: '',
        data: activeDapp ? [activeDapp] : [],
        type: 'active',
      },

      {
        title: 'Favorites',
        data: favoriteApps,
      },
    ].filter(item => item.data.length);
  }, [activeDapp, favoriteApps]);

  // useEffect(() => {
  //   getDapps();
  // }, [activeDapp, getDapps]);

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <DappCardList
          sections={dappSections}
          onPress={dapp => {
            setActiveDapp(dapp);
            toggleShowSheetModal('webviewContainerRef', true);
          }}
          onFavoritePress={dapp => {
            updateFavorite(dapp.origin, !dapp.isFavorite);
          }}
          onRemovePress={dapp => {
            removeDapp(dapp.origin);
          }}
          onDisconnectPress={dapp => {
            disconnectDapp(dapp.origin);
          }}
        />
      </View>

      <SheetDappWebView />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: AppColorsVariants) =>
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
