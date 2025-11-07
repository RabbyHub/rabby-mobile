import { CHAINS_ENUM } from '@debank/common';
import { findChainByEnum } from '@/utils/chain';
import { appStorage } from '../storage/mmkv';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import axios from 'axios';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { DefaultRPCRes } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import dayjs from 'dayjs';
import { isNonPublicProductionEnv } from '@/constant';

type RPCDefaultItem = DefaultRPCRes['rpcs'][number];

export interface RPCItem {
  url: string;
  enable: boolean;
}

export type RPCServiceStore = {
  customRPC: Record<string, RPCItem>;
  defaultRPC?: Record<string, RPCDefaultItem>;
  defaultRPCLastUpdateAt?: number;
};

export const BE_SUPPORTED_METHODS: string[] = [
  'eth_call',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_chainId',
];

async function submitTxWithFallbackRpcs<T>(
  rpcUrls: string[],
  fn: (rpc: string) => Promise<T>,
): Promise<[T, string]> {
  return new Promise((resolve, reject) => {
    let errorCount = 0;
    rpcUrls.forEach(url => {
      fn(url)
        .then(result => {
          resolve([result, url]);
        })
        .catch(err => {
          errorCount++;
          if (errorCount === rpcUrls.length) {
            reject(err);
          }
        });
    });
  });
}

async function callWithFallbackRpcs<T>(
  rpcUrls: string[],
  fn: (rpc: string) => Promise<T>,
): Promise<T> {
  let error;
  for (const url of rpcUrls) {
    try {
      const result = await fn(url);
      return result;
    } catch (err) {
      if (!error) {
        error = err;
      }
      console.warn(`RPC failed: ${url}`, err);
    }
  }
  throw error;
}

const MAX = 4_294_967_295;
let idCounter = Math.floor(Math.random() * MAX);

function getUniqueId(): number {
  idCounter = (idCounter + 1) % MAX;
  return idCounter;
}

// TODO: remove
const fetchDefaultRpc = async () => {
  const { data } = await axios.get('https://api.rabby.io/v1/chainrpc');
  return data.rpcs as RPCDefaultItem[];
};

class CustomRPCService {
  store: RPCServiceStore = {
    customRPC: {},
    defaultRPC: {},
    defaultRPCLastUpdateAt: 0,
  };
  rpcStatus: Record<
    string,
    {
      expireAt: number;
      available: boolean;
    }
  > = {};
  constructor(options?: StorageAdapaterOptions) {
    this.init(options);
  }

  init = (options?: StorageAdapaterOptions) => {
    const storage = createPersistStore<RPCServiceStore>(
      {
        name: APP_STORE_NAMES.rpc,
        template: {
          customRPC: {},
          defaultRPC: {},
          defaultRPCLastUpdateAt: 0,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    this.store = storage || this.store;

    {
      // remove unsupported chain
      let changed = false;
      Object.keys({ ...this.store.customRPC }).forEach(chainEnum => {
        if (!findChainByEnum(chainEnum)) {
          changed = true;
          delete this.store.customRPC[chainEnum];
        }
      });

      if (changed) {
        this.store.customRPC = { ...this.store.customRPC };
      }
    }

    this.syncDefaultRPC();
  };

  getDefaultRPCLastUpdateAt = () => {
    return this.store.defaultRPCLastUpdateAt;
  };

  setDefaultRPCLastUpdateAt = (timestamp: number) => {
    this.store.defaultRPCLastUpdateAt = timestamp;
  };

  syncDefaultRPC = async (ignoreLastUpdateAt = true) => {
    try {
      if (
        ignoreLastUpdateAt ||
        dayjs(this.getDefaultRPCLastUpdateAt()).isBefore(
          dayjs().subtract(1, 'hour'),
        )
      ) {
        console.log(
          `${
            ignoreLastUpdateAt ? 'force ' : ''
          }Updating default RPCs...,last update at:`,
          dayjs(this.getDefaultRPCLastUpdateAt()).format('YYYY-MM-DD HH:mm:ss'),
        );
        // TODO: remove  after test
        const data = isNonPublicProductionEnv
          ? await fetchDefaultRpc()
          : (await openapi.getDefaultRPCs())?.rpcs;
        if (data.length) {
          console.log('Default RPCs updated successfully.');
          this.setDefaultRPCLastUpdateAt(Date.now());
          const defaultRPC: Record<string, RPCDefaultItem> = data?.reduce(
            (acc, item) => {
              acc[item.chainId] = item;

              return acc;
            },
            {} as Record<string, RPCDefaultItem>,
          );
          this.store.defaultRPC = defaultRPC;
        }
      }
    } catch (error) {
      console.error('Failed to fetch default RPC:', error);
    }
  };

  defaultRPCRequest = async (
    host: string,
    method: string,
    params: any[],
    timeout = 5000,
  ) => {
    const { data } = await axios.post(
      host,
      {
        jsonrpc: '2.0',
        id: getUniqueId(),
        params,
        method,
      },
      {
        timeout,
      },
    );
    if (data?.error) throw data.error;
    return data.result;
  };

  defaultEthRPC = ({
    chainServerId,
    origin = INTERNAL_REQUEST_ORIGIN,
    method,
    params,
  }: {
    chainServerId: string;
    origin?: string;
    method: string;
    params: any;
  }) => {
    const isBESupported = this.supportedRpcMethodByBE(method);
    const hostList = this?.store?.defaultRPC?.[chainServerId]?.rpcUrl || [];

    if (isBESupported || !hostList?.length) {
      return openapi.ethRpc(chainServerId, {
        origin: encodeURIComponent(origin),
        method,
        params,
      });
    }
    // return this.requestDefaultRPC(chainServerId, method, params);
    return callWithFallbackRpcs(hostList, rpc =>
      this.defaultRPCRequest(rpc, method, params),
    );
  };

  getDefaultRPCByChainServerId = (chainServerId: string) => {
    return this.store.defaultRPC?.[chainServerId];
  };

  supportedRpcMethodByBE = (method?: string) => {
    return BE_SUPPORTED_METHODS.some(e => e === method);
  };

  defaultRPCSubmitTxWithFallback = async (
    chainServerId: string,
    method: string,
    params: any[],
  ) => {
    const hostList = this?.store?.defaultRPC?.[chainServerId]?.rpcUrl || [];
    if (!hostList.length) {
      throw new Error(`No available rpc for ${chainServerId}`);
    }
    return submitTxWithFallbackRpcs(hostList, rpc =>
      this.defaultRPCRequest(rpc, method, params),
    );
  };

  requestDefaultRPC = async (
    chainServerId: string,
    method: string,
    params: any[],
  ) => {
    const hostList = this?.store?.defaultRPC?.[chainServerId]?.rpcUrl || [];
    if (!hostList.length) {
      throw new Error(`No available rpc for ${chainServerId}`);
    }
    // return callWithFallbackRpcs(hostList, (rpc) =>
    //   this.request(rpc, method, params)
    // );
    return this.request(hostList[0], method, params);
  };

  getDefaultRPC = (chainServerId: string) => {
    return this.store.defaultRPC?.[chainServerId];
  };

  hasCustomRPC = (chain: CHAINS_ENUM) => {
    return false;
    // return this.store.customRPC[chain] && this.store.customRPC[chain].enable;
  };

  getRPCByChain = (chain: CHAINS_ENUM) => {
    return this.store.customRPC[chain];
  };

  getAllRPC = () => {
    return {};
    // return this.store.customRPC;
  };

  setRPC = (chain: CHAINS_ENUM, url: string) => {
    const rpcItem = this.store.customRPC[chain]
      ? {
          ...this.store.customRPC[chain],
          url,
        }
      : {
          url,
          enable: true,
        };
    this.store.customRPC = {
      ...this.store.customRPC,
      [chain]: rpcItem,
    };
    if (this.rpcStatus[chain]) {
      delete this.rpcStatus[chain];
    }
  };

  setRPCEnable = (chain: CHAINS_ENUM, enable: boolean) => {
    this.store.customRPC = {
      ...this.store.customRPC,
      [chain]: {
        ...this.store.customRPC[chain],
        enable,
      },
    };
  };

  removeCustomRPC = (chain: CHAINS_ENUM) => {
    const map = this.store.customRPC;
    delete map[chain];
    this.store.customRPC = { ...map };
    if (this.rpcStatus[chain]) {
      delete this.rpcStatus[chain];
    }
  };

  requestCustomRPC = async (
    chain: CHAINS_ENUM,
    method: string,
    params: any[],
  ) => {
    const host = this.store.customRPC[chain]?.url;
    if (!host) {
      throw new Error(`No customRPC set for ${chain}`);
    }
    return this.request(host, method, params);
  };

  request = async (
    host: string,
    method: string,
    params: any[],
    timeout = 5000,
  ) => {
    const { data } = await axios.post(
      host,
      {
        jsonrpc: '2.0',
        id: getUniqueId(),
        params,
        method,
      },
      {
        timeout,
      },
    );
    if (data?.error) throw data.error;
    if (data?.result) return data.result;
    return data;
  };

  ping = async (chain: CHAINS_ENUM) => {
    if (this.rpcStatus[chain]?.expireAt > Date.now()) {
      return this.rpcStatus[chain].available;
    }
    const host = this.store.customRPC[chain]?.url;
    if (!host) return false;
    try {
      await this.request(host, 'eth_blockNumber', [], 2000);
      this.rpcStatus = {
        ...this.rpcStatus,
        [chain]: {
          ...this.rpcStatus[chain],
          expireAt: Date.now() + 60 * 1000,
          available: true,
        },
      };
      return true;
    } catch (e) {
      this.rpcStatus = {
        ...this.rpcStatus,
        [chain]: {
          ...this.rpcStatus[chain],
          expireAt: Date.now() + 60 * 1000,
          available: false,
        },
      };
      return false;
    }
  };
}

export const customRPCService = new CustomRPCService({
  storageAdapter: appStorage,
});
