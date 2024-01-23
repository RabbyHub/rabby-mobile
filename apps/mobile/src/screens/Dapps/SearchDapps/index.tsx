import React, { useEffect, useMemo } from 'react';

import RcIconClose from '@/assets/icons/dapp/icon-close-circle.svg';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { ScreenLayouts } from '@/constant/layout';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappInfo } from '@/core/services/dappService';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@rneui/themed';
import { useDebounce, useInfiniteScroll } from 'ahooks';
import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { LinkCard } from './components/LinkCard';
import { SearchDappCardList } from './components/SearchDappCardList';
import { SearchEmpty } from './components/SearchEmpty';
import { SearchSuggest } from './components/SearchSuggest';
import {
  useActiveViewSheetModalRefs,
  useOpenUrlView,
  useOpenDappView,
} from '../hooks/useDappView';
import { stringUtils } from '@rabby-wallet/base-utils';
import { createGlobalBottomSheetModal } from '@/components/GlobalBottomSheetModal/utils';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { CHAINS_ENUM } from '@debank/common';
import { findChainByEnum } from '@/utils/chain';
import { isPossibleDomain } from '@/utils/url';

export function SearchDappsScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();

  React.useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const styles = React.useMemo(() => getStyles(colors), [colors]);

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

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <SearchBar
          ref={ref}
          platform="ios"
          placeholder="Input Dapp name label or URL"
          placeholderTextColor={colors['neutral-foot']}
          containerStyle={styles.searchContainer}
          inputContainerStyle={styles.searchInputContainer}
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
        />
      </View>
      {debouncedSearchValue ? (
        <>
          <LinkCard
            url={debouncedSearchValue}
            onPress={generalUrl => {
              // TODO: should we validate the url?
              openUrlAsDapp(generalUrl);
              toggleShowSheetModal('dappWebviewBottomSheetModalRef', true);
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
              toggleShowSheetModal('dappWebviewBottomSheetModalRef', true);
              console.log('press dapp', dapp.origin);
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
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
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
    searchInput: {
      color: colors['neutral-title-1'],
      fontSize: 14,
      lineHeight: 17,
    },
    searchIcon: {
      width: 16,
      height: 16,
      color: colors['neutral-foot'],
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

export default SearchDappsScreen;
