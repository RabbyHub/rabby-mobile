import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';
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
import { Keyboard, Text, View } from 'react-native';
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
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { RcIconGoogle } from '@/assets/icons/dapp';
import { useBrowserTabs } from '@/screens/Browser/hooks/useBrowserTabs';

export function DappsScreen(): JSX.Element {
  const {
    browserHistoryList,
    favoriteApps,
    setBrowserHistory,
    setDapp,
    removeBrowserHistory,
    disconnectDapp,
  } = useDappsHome();
  const { openUrlAsDapp } = useBrowserTabs();

  const { styles, colors2024, isLight } = useTheme2024({
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
      // setBrowserHistory(safeGetOrigin(url));
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

  // todo fix any
  const inputRef = useRef<any>(null);

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
            <NextSearchBar
              style={styles.searchBar}
              placeholder={IS_IOS ? 'Search website' : 'Search Dapp'}
              value={searchState.state.searchText}
              searchIcon={<RcIconGoogle />}
              alwaysShowCancel
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
                navigation.goBack();
              }}
              ref={inputRef}
            />
          </View>
          <View style={styles.container}>
            <DappFavoriteSection
              data={favoriteApps}
              onPress={handleOpenURLDebounced}
            />
          </View>
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
