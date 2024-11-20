import { TextInputProps } from 'react-native';
/* eslint-disable @typescript-eslint/no-shadow */
// import { useOpenDappView } from '../hooks/useDappView';
import { CHAINS_ENUM } from '@/constant/chains';
import { openapi } from '@/core/request';
import { DappInfo } from '@/core/services/dappService';
import { useDapps } from '@/hooks/useDapps';
import { findChainByEnum } from '@/utils/chain';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useDebounce, useInfiniteScroll, useSetState } from 'ahooks';
import { useEffect, useMemo, useState } from 'react';
import { useParsePossibleURL } from './useParsePossibleURL';

export const useSearchDapps = () => {
  const { dapps } = useDapps();
  const [searchState, setSearchState] = useSetState<{
    chain?: CHAINS_ENUM;
    searchText: string;
    isFocus: boolean;
    loading: boolean;
  }>({
    chain: undefined,
    searchText: '',
    isFocus: false,
    loading: false,
  });

  const debouncedSearchValue = useDebounce(searchState.searchText, {
    wait: 500,
  });
  const url = useParsePossibleURL(debouncedSearchValue);

  const { data, loadMore } = useInfiniteScroll(
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
      const chainInfo = findChainByEnum(searchState.chain);
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
      reloadDeps: [debouncedSearchValue, searchState.chain],
      isNoMore(data) {
        return !!data && (data?.list?.length || 0) >= data?.page?.total;
      },
      onFinally() {
        setSearchState({
          loading: false,
        });
      },
    },
  );

  const { list, currentDapp } = useMemo(() => {
    const list: DappInfo[] = [];
    let _currentDapp: DappInfo | null = null;

    (data?.list || []).forEach(info => {
      const origin = stringUtils.ensurePrefix(info.id, 'https://');
      const local = dapps[origin];

      const dappInfo = {
        ...local,
        origin,
        info,
      } as DappInfo;

      if (!_currentDapp && origin === url) {
        _currentDapp = dappInfo;
      } else {
        list.push(dappInfo);
      }
    });
    return {
      list,
      currentDapp: _currentDapp as DappInfo | null,
    };
  }, [dapps, data?.list, url]);

  const returnKeyType = useMemo(() => {
    return url ? ('go' as const) : undefined;
  }, [url]);

  return {
    list,
    total: currentDapp ? data?.page?.total - 1 : data?.page?.total,
    currentDapp,
    state: searchState,
    setState: setSearchState,
    loadMore,
    currentURL: url,
    returnKeyType,
  };
};
