import { RcNextLeftCC } from '@/assets/icons/common';
import {
  NextSearchBar,
  NextSearchBarMethods,
} from '@/components2024/SearchBar';
import { toast } from '@/components2024/Toast';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useNavigation } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import React, { useMemo, useRef } from 'react';
import { Keyboard, View } from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappFavoriteSection } from '../components/DappFavoriteSection/index';
import { DappHistorySection } from '../components/DappHistorySection';
import { DappSearchSection } from '../components/DappSearchSection';
import { useDappWebViewScreen } from '../hooks/useDappWebViewScreen';
import { useSearchDapps } from '../hooks/useSearchDapps';
import LinearGradient from 'react-native-linear-gradient';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { IS_IOS } from '@/core/native/utils';
import { debounce } from 'lodash';

export function DappsScreen(): JSX.Element {
  const {
    browserHistoryList,
    favoriteApps,
    setBrowserHistory,
    setDapp,
    removeBrowserHistory,
    disconnectDapp,
  } = useDappsHome();
  const { openUrlAsDapp } = useDappWebViewScreen();

  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const navigation = useNavigation();
  const searchState = useSearchDapps();

  type OpenUrlAsDappOptions = Pick<
    Parameters<typeof openUrlAsDapp>[1] & object,
    'forceReopen'
  >;
  const handleOpenURL = useMemoizedFn(
    (url: string, options?: OpenUrlAsDappOptions) => {
      openUrlAsDapp(url, {
        ...options,
        dappsWebViewFromRoute: RootNames.Dapps,
      });
      // @ts-expect-error code has been expired due to biz changes, whole file could be removed later
      setBrowserHistory(safeGetOrigin(url));
      Keyboard.dismiss();
    },
  );

  const handleFavoriteDapp = useMemoizedFn((dapp: DappInfo) => {
    const v = !dapp.isFavorite;
    setDapp({
      ...dapp,
      isFavorite: v,
      favoriteAt: v ? Date.now() : null,
    });
  });

  const handleDeleteHistory = useMemoizedFn((dapp: DappInfo) => {
    removeBrowserHistory(dapp.origin);
    disconnectDapp(dapp.origin);
    toast.success('Removed from History');
  });

  const inputRef = useRef<NextSearchBarMethods>(null);

  const handleEmptyPress = useMemoizedFn(() => {
    searchState.setState({
      searchText: '',
      isFocus: true,
    });
    inputRef.current?.focus();
  });

  const handleOpenURLDebounced = useMemo(() => {
    return debounce((dapp: DappInfo) => {
      handleOpenURL(dapp.origin);
    }, 200);
  }, [handleOpenURL]);

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
                onPress={handleOpenURLDebounced}
                onFavoritePress={handleFavoriteDapp}
                onDeletePress={handleDeleteHistory}
                HeaderComponent={
                  <DappFavoriteSection
                    data={favoriteApps}
                    onPress={handleOpenURLDebounced}
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
              onOpenURL={(newUrl: string) =>
                handleOpenURL(newUrl, { forceReopen: true })
              }
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
    marginTop: 16,
  },

  header: {
    paddingLeft: 20,
    paddingRight: 24,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 52,
  },
  searchBar: {
    flex: 1,
  },
  sectionTop: {
    paddingHorizontal: 20,
    // marginBottom: 24,
  },
}));
