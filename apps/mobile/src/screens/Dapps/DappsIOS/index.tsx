import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useMemo } from 'react';

import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeStyles } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
// import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { SearchBar } from '@rneui/themed';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
} from '../hooks/useDappView';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import RcIconClose from '@/assets/icons/dapp/icon-close-circle.svg';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { findChainByEnum } from '@/utils/chain';
import { openapi } from '@/core/request';
import { CHAINS_ENUM } from '@/constant/chains';
import { useDebounce, useInfiniteScroll } from 'ahooks';
import { LinkCard } from '../SearchDapps/components/LinkCard';
import { SearchDappCardList } from '../SearchDapps/components/SearchDappCardList';
import { SearchEmpty } from '../SearchDapps/components/SearchEmpty';
import { SearchSuggest } from '../SearchDapps/components/SearchSuggest';
import { stringUtils } from '@rabby-wallet/base-utils';
import { DappInfo } from '@/core/services/dappService';
import { isPossibleDomain } from '@/utils/url';
import { DappCardList } from '../Dapps/components/DappCardList';
import { EmptyDapps } from './components/EmptyDapps';
import { ScreenLayouts } from '@/constant/layout';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

export function DappsIOSScreen(): JSX.Element {
  const { styles, colors } = useThemeStyles(getStyles);

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText>
        {Platform.OS === 'ios' ? 'Explore' : 'Dapps'}
      </HeaderTitleText>
    );
  }, []);

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  const {
    dappSections,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    dapps,
    addDapp,
  } = useDappsHome();
  const { openUrlAsDapp, closeOpenedDapp } = useOpenDappView();

  const ref = React.useRef<any>(null);
  const [chain, setChain] = React.useState<CHAINS_ENUM>();
  const [searchText, setSearchText] = React.useState('');
  const [isFocus, setIsFoucs] = React.useState(false);

  const debouncedSearchValue = useDebounce(searchText, {
    wait: 500,
  });

  const { data, loading, loadMore } = useInfiniteScroll(
    async d => {
      if (!debouncedSearchValue) {
        return {
          list: [],
          page: {
            start: 0,
            limit: 0,
            total: 0,
          },
          next: 0,
        };
      }
      const limit = d?.page?.limit || 30;
      const start = d?.next || 0;
      const chainInfo = findChainByEnum(chain);
      const res = await openapi.searchDapp({
        q: debouncedSearchValue,
        chain_id: chainInfo?.serverId,
        start,
        limit,
      });
      return {
        list: res.dapps,
        page: res.page,
        next: res.page.start + res.page.limit,
      };
    },
    {
      reloadDeps: [debouncedSearchValue, chain],
      target: ref,
      // eslint-disable-next-line @typescript-eslint/no-shadow
      isNoMore(data) {
        return !!data && (data?.list?.length || 0) >= data?.page?.total;
      },
    },
  );
  const list = useMemo(() => {
    return (data?.list || []).map(info => {
      const origin = stringUtils.ensurePrefix(info.id, 'https://');
      const local = dapps[origin];

      return {
        ...local,
        origin,
        info,
      } as DappInfo;
    });
  }, [dapps, data]);

  const isDomain = isPossibleDomain(debouncedSearchValue);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <NormalScreenContainer style={styles.page}>
        <View style={styles.header}>
          <SearchBar
            ref={ref}
            platform="ios"
            placeholder="Search name or URL"
            placeholderTextColor={colors['neutral-foot']}
            containerStyle={styles.searchContainer}
            inputContainerStyle={[
              styles.searchInputContainer,
              isFocus ? styles.searchInputContainerFocus : null,
            ]}
            inputStyle={styles.searchInput}
            searchIcon={
              <RcIconSearch style={styles.searchIcon} width={16} height={16} />
            }
            clearIcon={
              <TouchableWithoutFeedback
                onPress={() => {
                  ref?.current?.clear();
                }}>
                <RcIconClose />
              </TouchableWithoutFeedback>
            }
            value={searchText}
            onChangeText={v => {
              setSearchText(v);
              setChain(undefined);
              // runSearch(v);
            }}
            // showCancel
            showLoading={loading}
            cancelButtonProps={{
              buttonTextStyle: styles.cancelButton,
            }}
            // onClear={() => {
            //   setSearchText('');
            // }}
            onCancel={() => {
              // navigation.goBack();
            }}
            onFocus={() => {
              setIsFoucs(true);
            }}
            onBlur={() => {
              setIsFoucs(false);
            }}
          />
        </View>
        {!isFocus && !searchText ? (
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
        ) : (
          <View style={styles.container}>
            {debouncedSearchValue ? (
              <>
                <LinkCard
                  url={debouncedSearchValue}
                  onPress={generalUrl => {
                    // TODO: should we validate the url?
                    openUrlAsDapp(generalUrl, { showSheetModalFirst: true });
                    Keyboard.dismiss();
                  }}
                />
                <SearchDappCardList
                  chain={chain}
                  onChainChange={setChain}
                  onEndReached={loadMore}
                  data={list}
                  loading={loading}
                  empty={<SearchEmpty isDomain={isDomain} />}
                  total={data?.page?.total}
                  onPress={dapp => {
                    openUrlAsDapp(dapp.origin, { showSheetModalFirst: true });
                    Keyboard.dismiss();
                  }}
                  onFavoritePress={dapp => {
                    addDapp({
                      ...dapp,
                      isFavorite: !dapp.isFavorite,
                    });
                  }}
                />
              </>
            ) : null}
          </View>
        )}
      </NormalScreenContainer>
    </TouchableWithoutFeedback>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    page: {
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      flex: 1,
      paddingBottom: ScreenLayouts.bottomBarHeight + 12,
    },

    searchContainer: {
      backgroundColor: 'transparent',
      paddingVertical: 6,
      paddingHorizontal: 0,
      marginRight: 0,
    },
    searchInputContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      borderWidth: 0.5,
      borderBottomWidth: 0.5, // don't delete
      borderColor: colors['neutral-line'],
      height: 50,
      marginLeft: 0,
      paddingRight: 0,
      marginRight: 0,
    },
    searchInputContainerFocus: {
      borderColor: colors['blue-default'],
      marginRight: 58,
    },
    searchInput: {
      color: colors['neutral-title-1'],
      fontSize: 14,
      lineHeight: undefined,
    },
    searchIcon: {
      width: 16,
      height: 16,
      color: colors['neutral-foot'],
      marginLeft: 6,
    },
    cancelButton: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['blue-default'],
      paddingRight: 0,
    },
    header: {
      paddingHorizontal: 20,
    },
  });
