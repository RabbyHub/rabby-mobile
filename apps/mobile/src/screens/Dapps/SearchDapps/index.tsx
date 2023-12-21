import React, { useMemo } from 'react';

import RcIconClose from '@/assets/icons/dapp/icon-close.svg';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@rneui/themed';
import { useRequest } from 'ahooks';
import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { LinkCard } from './components/LinkCard';
import { SearchDappCardList } from './components/SearchDappCardList';
import { SearchEmpty } from './components/SearchEmpty';
import { SearchSuggest } from './components/SearchSuggest';
import { ScreenLayouts } from '@/constant/layout';

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

  const {
    data,
    runAsync: runSearch,
    loading,
  } = useRequest(
    async (s: string) => {
      console.log({ s });
      if (!s) {
        return [];
      }
      return openapi.searchDapp({
        q: s,
      });
    },
    {
      manual: true,
      debounceLeading: true,
      debounceWait: 600,
    },
  );

  const { dapps, addDapp } = useDapps();

  const list = useMemo(() => {
    return (data || []).map(info => {
      const local = dapps[info.id];

      return {
        ...local,
        info,
      } as DappInfo;
    });
  }, [dapps, data]);

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
            runSearch(v);
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
      {searchText ? (
        <>
          <LinkCard url={searchText} />
          {loading ? null : list.length === 0 ? (
            <SearchEmpty />
          ) : (
            <SearchDappCardList
              data={list}
              onFavoritePress={dapp => {
                addDapp({
                  ...dapp,
                  isFavorite: !dapp.isFavorite,
                });
              }}
            />
          )}
        </>
      ) : (
        <SearchSuggest
          onPress={v => {
            runSearch(v);
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
