import React, { useMemo, useState } from 'react';

import RcIconClose from '@/assets/icons/dapp/icon-close-circle.svg';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { ScreenLayouts } from '@/constant/layout';
import { openapi } from '@/core/request';
import { DappInfo } from '@/core/services/dappService';
import { useThemeStyles } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { findChainByEnum } from '@/utils/chain';
import { isPossibleDomain } from '@/utils/url';
import { CHAINS_ENUM } from '@/constant/chains';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@rneui/themed';
import { useDebounce, useInfiniteScroll } from 'ahooks';
import {
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
  useOpenUrlView,
} from '../hooks/useDappView';
import { LinkCard } from './components/LinkCard';
import { SearchDappCardList } from './components/SearchDappCardList';
import { SearchEmpty } from './components/SearchEmpty';
import { SearchSuggest } from './components/SearchSuggest';
import { createGetStyles } from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

export function SearchDappsScreen(): JSX.Element {
  const { colors, styles } = useThemeStyles(getStyles);
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();

  React.useEffect(() => {
    setNavigationOptions({
      headerShown: false,
    });
  }, [setNavigationOptions]);

  const [searchText, setSearchText] = React.useState('');

  const ref = React.useRef<any>(null);
  const [chain, setChain] = React.useState<CHAINS_ENUM>();

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

  const { dapps, addDapp } = useDapps();

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

  const { openUrlAsDapp } = useOpenDappView();
  const { setOpenedUrl } = useOpenUrlView();
  const { toggleShowSheetModal } = useActiveViewSheetModalRefs();
  const isDomain = isPossibleDomain(debouncedSearchValue);
  const [isFocus, setIsFocus] = useState(false);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={styles.page}>
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
            showCancel
            showLoading={loading}
            cancelButtonProps={{
              buttonTextStyle: styles.cancelButton,
            }}
            // onClear={() => {
            //   setSearchText('');
            // }}
            onCancel={() => {
              navigation.goBack();
            }}
            autoFocus
            onFocus={() => {
              setIsFocus(true);
            }}
            onBlur={() => {
              setIsFocus(false);
            }}
          />
        </View>
        {debouncedSearchValue ? (
          <>
            <LinkCard
              url={debouncedSearchValue}
              onPress={generalUrl => {
                // TODO: should we validate the url?
                openUrlAsDapp(generalUrl);
                toggleShowSheetModal('openedDappWebviewSheetModalRef', true);
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
                openUrlAsDapp(dapp.origin);
                toggleShowSheetModal('openedDappWebviewSheetModalRef', true);
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
        ) : (
          <SearchSuggest
            onPress={v => {
              // runSearch(v);
              setSearchText(v);
            }}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    page: {
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: colors['neutral-bg-2'],
      paddingTop: ScreenLayouts.headerAreaHeight,
    },
    container: {
      padding: 20,
    },
    searchContainer: {
      backgroundColor: 'transparent',
      paddingVertical: 6,
      paddingHorizontal: 0,
    },
    searchInputContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      borderWidth: 0.5,
      borderBottomWidth: 0.5, // don't delete
      borderColor: colors['neutral-line'],
      height: 50,
      marginLeft: 0,
    },
    searchInputContainerFocus: {
      borderColor: colors['blue-default'],
    },
    searchInput: {
      color: colors['neutral-title-1'],
      fontSize: 14,
      lineHeight: 17,
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
  };
});

export default SearchDappsScreen;
