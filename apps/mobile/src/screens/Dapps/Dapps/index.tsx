import React, { useEffect, useMemo } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { DappCardList } from './components/DappCardList';
// import { useRequest } from 'ahooks';
import { useDappsHome } from '@/hooks/useDapps';
import { AppColorsVariants } from '@/constant/theme';
import { useDapps } from '@/hooks/useDapps';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
} from '../hooks/useDappView';

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
  const { openUrlAsDapp, closeOpenedDapp } = useOpenDappView();
  const { toggleShowSheetModal } = useActiveViewSheetModalRefs();
  // todo refresh dapps when webview close

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <DappCardList
          sections={dappSections}
          onPress={dapp => {
            openUrlAsDapp(dapp.origin);
            toggleShowSheetModal('dappWebviewBottomSheetModalRef', true);
          }}
          onFavoritePress={dapp => {
            updateFavorite(dapp.origin, !dapp.isFavorite);
          }}
          onClosePress={dapp => {
            // for 'inUse' section, close it rather than remove it.
            closeOpenedDapp(dapp.origin);
          }}
          onRemovePress={dapp => {
            // for 'favorites' section, close it rather than remove it.
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
