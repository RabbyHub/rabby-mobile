import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';
import { toast } from '@/components2024/Toast';
import { ScreenLayouts } from '@/constant/layout';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useNavigation } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import React, { useRef } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { IS_IOS } from '@/core/native/utils';

export function DappsScreen(): JSX.Element {
  const {
    browserHistoryList,
    favoriteApps,
    setBrowserHistory,
    setDapp,
    removeBrowserHistory,
    disconnectDapp,
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

  const handleFavoriteDapp = (dapp: DappInfo) => {
    const v = !dapp.isFavorite;
    setDapp({
      ...dapp,
      isFavorite: v,
      favoriteAt: v ? Date.now() : null,
    });
  };

  const handleDeleteHistory = useMemoizedFn((dapp: DappInfo) => {
    removeBrowserHistory(dapp.origin);
    disconnectDapp(dapp.origin);
    toast.success('Removed from History');
  });

  // todo fix any
  const inputRef = useRef<any>(null);

  const handleEmptyPress = useMemoizedFn(() => {
    searchState.setState({
      searchText: '',
      isFocus: true,
    });
    inputRef.current?.focus();
  });

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        start={{ x: 0, y: 0.1185 }}
        end={{ x: 0, y: 0.5235 }}>
        <NormalScreenContainer noHeader overwriteStyle={styles.page}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (searchState.state.isFocus || searchState.state.searchText) {
                  searchState.setState({
                    chain: undefined,
                    searchText: '',
                    loading: false,
                  });
                } else if (navigation.canGoBack()) {
                  navigation.goBack();
                }
                Keyboard.dismiss();
              }}>
              <RcNextLeftCC color={colors2024['neutral-title-1']} />
            </TouchableOpacity>
            <NextSearchBar
              style={styles.searchBar}
              placeholder={
                IS_IOS
                  ? 'Search website name or URL'
                  : 'Search Dapp name or URL'
              }
              value={searchState.state.searchText}
              onChangeText={v => {
                searchState.setState({
                  chain: undefined,
                  searchText: v,
                  loading: true,
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
              onCancel={() => {
                searchState.setState({
                  isFocus: false,
                  searchText: '',
                  chain: undefined,
                });
              }}
              ref={inputRef}
              // returnKeyType={searchState.returnKeyType}
              // onSubmitEditing={() => {
              //   const url =
              //     searchState.currentDapp?.origin || searchState.currentURL;
              //   if (url) {
              //     handleOpenURL(url);
              //   }
              //   // console.log('keyPress', e.nativeEvent.key, url);
              // }}
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
              loading={searchState.state.loading}
              total={searchState.total}
              onChainChange={c => {
                searchState.setState({
                  chain: c,
                  loading: true,
                });
              }}
              chain={searchState.state.chain}
              onFavoritePress={handleFavoriteDapp}
              onOpenURL={handleOpenURL}
              currentDapp={searchState.currentDapp}
              currentURL={searchState.currentURL}
              searchText={searchState.state.searchText}
              onEmptyPress={handleEmptyPress}
            />
          )}
        </NormalScreenContainer>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    marginTop: 20,
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  searchBar: {
    flex: 1,
  },
  sectionTop: {
    paddingHorizontal: 20,
    // marginBottom: 24,
  },
}));
