import { RcNextLeftCC } from '@/assets/icons/common';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { NextSearchBar } from '@/components2024/SearchBar';
import { ScreenLayouts } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useNavigation } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { Keyboard, View } from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappFavoriteSection } from '../components/DappFavoriteSection/index';
import { DappHistorySection } from '../components/DappHistorySection';
import { DappSearchSection } from '../components/DappSearchSection';
import { useOpenDappView } from '../hooks/useDappView';
import { useSearchDapps } from '../hooks/useSearchDapps';
import { DappInfo } from '@/core/services/dappService';

export function DappsScreen(): JSX.Element {
  const {
    browserHistoryList,
    favoriteApps,
    setBrowserHistory,
    setDapp,
    removeBrowserHistory,
  } = useDappsHome();
  const { openUrlAsDapp } = useOpenDappView();

  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const navigation = useNavigation();
  const searchState = useSearchDapps();

  const handleOpenURL = useMemoizedFn((url: string) => {
    openUrlAsDapp(url, {
      showSheetModalFirst: true,
    });
    setBrowserHistory(safeGetOrigin(url));
    Keyboard.dismiss();
  });

  const handleFavoriteDapp = dapp => {
    setDapp({
      ...dapp,
      isFavorite: !dapp.isFavorite,
    });
  };

  const handleDeleteHistory = useMemoizedFn((dapp: DappInfo) => {
    removeBrowserHistory(dapp.origin);
  });

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <NormalScreenContainer noHeader overwriteStyle={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}>
            <RcNextLeftCC color={colors2024['neutral-title-1']} />
          </TouchableOpacity>
          <NextSearchBar
            style={styles.searchBar}
            placeholder="Search Dapp name or URL"
            value={searchState.state.searchText}
            onChangeText={v => {
              searchState.setState({
                chain: undefined,
                searchText: v,
              });
            }}
            onFocus={() => {
              searchState.setState({
                isFocus: true,
              });
            }}
            onBlur={() => {
              searchState.setState({
                isFocus: false,
              });
            }}
            returnKeyType={searchState.returnKeyType}
            onSubmitEditing={() => {
              const url =
                searchState.currentDapp?.origin || searchState.currentURL;
              if (url) {
                handleOpenURL(url);
              }
              // console.log('keyPress', e.nativeEvent.key, url);
            }}
            // enterKeyHint={searchState.returnKeyType ? 'go' : undefined}
          />
        </View>
        {!searchState.state.isFocus && !searchState.state.searchText ? (
          <View style={styles.container}>
            <DappHistorySection
              style={{ height: '100%' }}
              data={browserHistoryList}
              onPress={dapp => {
                handleOpenURL(dapp.origin);
              }}
              onFavoritePress={handleFavoriteDapp}
              onDeletePress={handleDeleteHistory}
              HeaderComponent={
                <DappFavoriteSection
                  data={favoriteApps}
                  onPress={dapp => {
                    handleOpenURL(dapp.origin);
                  }}
                />
              }
            />
          </View>
        ) : (
          <DappSearchSection
            list={searchState.list}
            loadMore={searchState.loadMore}
            loading={searchState.loading}
            total={searchState.total}
            onChainChange={c => {
              searchState.setState({
                chain: c,
              });
            }}
            chain={searchState.state.chain}
            onFavoritePress={handleFavoriteDapp}
            onOpenURL={handleOpenURL}
            currentDapp={searchState.currentDapp}
            currentURL={searchState.currentURL}
            searchText={searchState.state.searchText}
          />
        )}
      </NormalScreenContainer>
    </TouchableWithoutFeedback>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    // todo
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingBottom: ScreenLayouts.bottomBarHeight + 12,
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,

    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
  },
  sectionTop: {
    paddingHorizontal: 20,
    // marginBottom: 24,
  },
}));
