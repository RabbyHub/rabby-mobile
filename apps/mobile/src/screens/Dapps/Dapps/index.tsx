import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { useNavigation } from '@react-navigation/native';
import { Platform, StyleSheet, View } from 'react-native';
import { DappCardList } from './components/DappCardList';
// import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useDappsHome } from '@/hooks/useDapps';
import { DappsIOSScreen } from '../DappsIOS';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
} from '../hooks/useDappView';
import { EmptyDapps } from './components/EmptyDapps';

export const DappsScreen = () => {
  return Platform.OS === 'ios' ? <DappsIOSScreen /> : <DappsScreenRaw />;
};

export function DappsScreenRaw(): JSX.Element {
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
            toggleShowSheetModal('openedDappWebviewSheetModalRef', true);
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
          ListEmptyComponent={EmptyDapps}
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
