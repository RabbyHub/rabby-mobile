/* eslint-disable @typescript-eslint/no-shadow */
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useMemo } from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { Keyboard, View } from 'react-native';
// import { useRequest } from 'ahooks';
import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';
import { CHAINS_ENUM } from '@/constant/chains';
import { ScreenLayouts } from '@/constant/layout';
import { openapi } from '@/core/request';
import { DappInfo } from '@/core/services/dappService';
import { useDappsHome } from '@/hooks/useDappsHome';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useNavigation } from '@react-navigation/native';
import { useDebounce, useInfiniteScroll } from 'ahooks';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappCard } from '../components/DappCard';
import { DappFavoriteSection } from '../components/DappFavoriteSection/index';
import { DappHistorySection } from '../components/DappHisotrySection';
import { useOpenDappView } from '../hooks/useDappView';
import { useParsePossibleURL } from '../hooks/useParsePossibleURL';
import { DappSearchEmpty } from '../SearchDapps/components/DappSearchEmpty';
import { LinkCard } from '../SearchDapps/components/LinkCard';
import { SearchDappCardList } from '../SearchDapps/components/SearchDappCardList';

export function DappsIOSScreen(): JSX.Element {
  const {
    dappSections,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    dapps,
    addDapp,
    favoriteApps,
  } = useDappsHome();
  const { openUrlAsDapp, closeOpenedDapp } = useOpenDappView();

  const ref = React.useRef<any>(null);
  const [chain, setChain] = React.useState<CHAINS_ENUM>();
  const [searchText, setSearchText] = React.useState('');
  const [isFocus, setIsFocus] = React.useState(false);

  const debouncedSearchValue = useDebounce(searchText, {
    wait: 500,
  });
  const url = useParsePossibleURL(debouncedSearchValue);

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
  const { list, currentDapp } = useMemo(() => {
    const list: DappInfo[] = [];
    let currentDapp: DappInfo | null = null;
    (data?.list || []).forEach(info => {
      const origin = stringUtils.ensurePrefix(info.id, 'https://');
      const local = dapps[origin];

      const dappInfo = {
        ...local,
        origin,
        info,
      };

      if (origin === url) {
        currentDapp = dappInfo;
      } else {
        list.push(dappInfo);
      }
    });
    return {
      list,
      currentDapp,
    };
  }, [dapps, data?.list, url]);
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const navigation = useNavigation();

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <NormalScreenContainer noHeader style={styles.page}>
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
            value={searchText}
            onChangeText={v => {
              setSearchText(v);
              setChain(undefined);
            }}
            onFocus={() => {
              setIsFocus(true);
            }}
            onBlur={() => {
              setIsFocus(false);
            }}
          />
        </View>
        {!isFocus && !searchText ? (
          <View style={styles.container}>
            <DappHistorySection
              style={{ height: '100%' }}
              data={favoriteApps}
              HeaderComponent={<DappFavoriteSection data={favoriteApps} />}
            />
          </View>
        ) : (
          <View style={styles.container}>
            {debouncedSearchValue ? (
              <>
                {url ? (
                  currentDapp ? (
                    <View style={styles.sectionTop}>
                      <DappCard data={currentDapp} isShowDesc />
                    </View>
                  ) : (
                    <LinkCard
                      url={url}
                      onPress={generalUrl => {
                        // TODO: should we validate the url?
                        openUrlAsDapp(generalUrl, {
                          showSheetModalFirst: true,
                        });
                        Keyboard.dismiss();
                      }}
                    />
                  )
                ) : null}
                {list?.length ? (
                  <SearchDappCardList
                    chain={chain}
                    onChainChange={setChain}
                    onEndReached={loadMore}
                    data={list}
                    loading={loading}
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
                ) : null}
                {!url && !list?.length && !loading ? <DappSearchEmpty /> : null}
              </>
            ) : null}
          </View>
        )}
      </NormalScreenContainer>
    </TouchableWithoutFeedback>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {},
  container: {
    flex: 1,
    paddingBottom: ScreenLayouts.bottomBarHeight + 12,
    paddingTop: 24,
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
