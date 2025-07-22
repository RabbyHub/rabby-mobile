/* eslint-disable @typescript-eslint/no-shadow */
// import { useOpenDappView } from '../hooks/useDappView';
import { openapi } from '@/core/request';
import { DappInfo } from '@/core/services/dappService';
import { useDapps } from '@/hooks/useDapps';
import { stringUtils } from '@rabby-wallet/base-utils';
import { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { useDebounce, useInfiniteScroll } from 'ahooks';
import { useMemo } from 'react';

export const useSearchDapps = (searchText: string) => {
  const { dapps } = useDapps();

  const debouncedSearchValue = useDebounce(searchText, {
    wait: 500,
  });

  const { data, loadMore } = useInfiniteScroll<{
    list: BasicDappInfo[];
    page?: {
      limit: number;
      total: number;
    };
    next?: number;
  }>(
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
      const res = await openapi.searchDapp({
        q: debouncedSearchValue,
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
      reloadDeps: [debouncedSearchValue],
      isNoMore(data) {
        return !!data && (data?.list?.length || 0) >= (data?.page?.total || 0);
      },
      onFinally() {},
    },
  );

  const url = '';

  const { list, currentDapp } = useMemo(() => {
    const list: DappInfo[] = [];
    let _currentDapp: DappInfo | null = null;

    (data?.list || []).forEach(info => {
      const origin = stringUtils.ensurePrefix(info.id, 'https://');
      const local = dapps[origin];

      const dappInfo = {
        ...local,
        name: local?.name || info?.name,
        icon: local?.icon || info?.logo_url,
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
    total: currentDapp ? (data?.page?.total || 0) - 1 : data?.page?.total,
    currentDapp,
    loadMore,
    currentURL: url,
    returnKeyType,
  };
};
