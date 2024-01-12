import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors } from '@/hooks/theme';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { DappCardList } from './components/DappCardList';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useDappsHome } from '@/hooks/useDapps';
import { AppColorsVariants } from '@/constant/theme';
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

  const { dappSections, updateFavorite, removeDapp, disconnectDapp } =
    useDappsHome();
  const { setActiveDapp } = useActiveDappView();
  const { toggleShowSheetModal } = useActiveDappViewSheetModalRefs();
  // todo refresh dapps when webview close

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
