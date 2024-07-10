import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { useNavigation } from '@react-navigation/native';
import { Platform, StyleSheet, View } from 'react-native';
import { DappCardList } from './components/DappCardList';
// import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { DappsIOSScreen } from '../DappsIOS';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
} from '../hooks/useDappView';
import { EmptyDapps } from './components/EmptyDapps';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { createGetStyles } from '@/utils/styles';

export const DappsScreen = () => {
  return Platform.OS === 'ios' ? <DappsIOSScreen /> : <DappsScreenRaw />;
};

export function DappsScreenRaw(): JSX.Element {
  const { styles } = useThemeStyles(getStyles);

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

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerRight: getHeaderRight,
    });
  }, [setNavigationOptions, getHeaderTitle, getHeaderRight]);

  const { dappSections, updateFavorite, removeDapp, disconnectDapp } =
    useDappsHome();
  const { openUrlAsDapp, closeOpenedDapp } = useOpenDappView();
  // todo refresh dapps when webview close

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <DappCardList
          sections={dappSections}
          onPress={dapp => {
            openUrlAsDapp(dapp.origin, { showSheetModalFirst: true });
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

const getStyles = createGetStyles((colors: AppColorsVariants) => {
  return {
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
  };
});
