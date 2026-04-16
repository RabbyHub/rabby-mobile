import { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { LRUCache } from 'lru-cache';
import { openapi } from '../request';
import { getAccountList } from '../apis/account';
import { getDappAccount } from '@/hooks/useDapps';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';

function asyncMemoize<T extends (...args: any[]) => Promise<any>>(
  method: T,
): T {
  const cache = new LRUCache<string, Promise<ReturnType<T>>>({
    max: 1000,
    ttl: 15 * 60 * 1000,
  });

  return async function (...args: any[]): Promise<any> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    cache.set(
      key,
      method(...args).catch(error => {
        cache.delete(key);
        throw error;
      }),
    );

    return cache.get(key);
  } as T;
}

const getOriginThirdPartyCollectList = asyncMemoize(
  openapi.getOriginThirdPartyCollectList,
);
const getRecommendChains = asyncMemoize(openapi.getRecommendChains);

const COUNT = 2;

export class AutoConnectService {
  dappService: import('./dappService').DappService;

  constructor(
    options: StorageAdapaterOptions & {
      dappService: import('./dappService').DappService;
    },
  ) {
    this.dappService = options.dappService;
  }

  autoConnect = async (origin: string) => {
    try {
      // disable polymarket auto connect
      if (origin === 'https://polymarket.com') {
        return;
      }
      if (!origin || !/^https?:\/\//.test(origin)) {
        return;
      }
      const site = this.dappService.getDapp(origin);
      if (site?.isConnected) {
        return;
      }

      const collectList = await getOriginThirdPartyCollectList(origin).then(
        res => res.collect_list,
      );
      if (collectList.length < COUNT) {
        return;
      }
      let defaultChain = site?.chainId;
      if (
        site?.chainId &&
        findChain({
          enum: site.chainId,
        })
      ) {
        defaultChain = site.chainId;
      }
      const { accounts } = await getAccountList();
      const defaultAccount = getDappAccount({
        dappInfo: site,
        accounts,
      })!;

      if (defaultAccount && !defaultChain) {
        const recommendChains = await getRecommendChains(
          defaultAccount.address,
          origin,
        );

        recommendChains.forEach(chain => {
          if (defaultChain) {
            return;
          }
          const info = findChain({ serverId: chain.id });
          if (info) {
            defaultChain = info.enum;
          }
        });
      }
      return {
        defaultAccount,
        defaultChain: defaultChain as CHAINS_ENUM | undefined,
      };
    } catch (e) {
      console.error('AutoConnectService autoConnect error', e);
    }
  };

  prepare = async (origin: string) => {
    try {
      if (!origin || !/^https?:\/\//.test(origin)) {
        return;
      }
      const site = this.dappService.getDapp(origin);
      if (site?.isConnected) {
        return;
      }

      const collectList = await getOriginThirdPartyCollectList(origin).then(
        res => res.collect_list,
      );
      if (collectList.length < COUNT) {
        return;
      }
      if (
        site?.chainId &&
        findChain({
          enum: site.chainId,
        })
      ) {
        return;
      }
      const { accounts } = await getAccountList();
      const defaultAccount = getDappAccount({
        dappInfo: site,
        accounts,
      })!;

      if (defaultAccount) {
        getRecommendChains(defaultAccount.address, origin);
      }
    } catch (e) {
      console.error('AutoConnectService prepare error', e);
    }
  };
}
