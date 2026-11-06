import {
  customTestnetTokenToTokenItem,
  isSameTestnetToken,
} from '@/utils/token';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { BigNumber } from 'bignumber.js';
import { sortBy } from 'lodash';
import cloneDeep from 'lodash/cloneDeep';
import {
  Client,
  createClient,
  defineChain,
  erc20Abi,
  http,
  isAddress,
} from 'viem';
import {
  estimateGas,
  estimateMaxPriorityFeePerGas,
  getBalance,
  getBlock,
  getGasPrice,
  getTransactionCount,
  getTransactionReceipt,
  readContract,
} from 'viem/actions';
import { GasLevel, Tx } from '@rabby-wallet/rabby-api/dist/types';
import axios from 'axios';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { updateChainStore } from '@/constant/chains';
import { syncCustomTestnetStore } from '@/store/customTestnet';
import { appStorage } from '../storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import type {
  CustomTestnetEip1559Detection,
  CustomTestnetToken,
  CustomTestnetTokenBase,
  TestnetChain,
  TestnetChainBase,
} from '@/types/customTestnet';
import { withTimeoutFallback } from '@/utils/async';
import {
  createTestnetChain,
  createTestnetChainList,
} from '@/core/utils/customTestnetChain';

export type {
  CustomTestnetToken,
  CustomTestnetTokenBase,
  TestnetChain,
  TestnetChainBase,
} from '@/types/customTestnet';

export type CutsomTestnetServiceStore = {
  customTestnet: Record<string, TestnetChain>;
  customTokenList: CustomTestnetTokenBase[];
  // detected from the chain itself, kept apart from the user-entered config
  eip1559: Record<string, CustomTestnetEip1559Detection>;
};

const MAX = 4_294_967_295;
let idCounter = Math.floor(Math.random() * MAX);

function getUniqueId(): number {
  idCounter = (idCounter + 1) % MAX;
  return idCounter;
}

const EIP1559_RECHECK_INTERVAL = 24 * 60 * 60 * 1000;
// an on-demand check falls back to the previous result after this
const EIP1559_DETECT_TIMEOUT = 5000;

// maxFeePerGas = baseFee * baseFeeMultiplier + tip * priorityFeeMultiplier
const EIP1559_GAS_LEVELS = [
  { level: 'slow', baseFeeMultiplier: 1.2, priorityFeeMultiplier: 1 },
  { level: 'normal', baseFeeMultiplier: 1.5, priorityFeeMultiplier: 1 },
  { level: 'fast', baseFeeMultiplier: 2, priorityFeeMultiplier: 1.5 },
];

export class CustomTestnetService extends StoreServiceBase<
  CutsomTestnetServiceStore,
  APP_STORE_NAMES.customTestnet
> {
  chains: Record<string, Client> = {};

  // one in-flight EIP-1559 check per network and RPC client
  private eip1559Detecting = new Map<
    number,
    { client: Client; task: Promise<boolean> }
  >();

  constructor(options?: StorageAdapaterOptions) {
    super();
    this.init(options);
  }

  initFromStorage = () => {
    this.init({
      storageAdapter: appStorage,
    });
  };

  init = (options?: StorageAdapaterOptions) => {
    this.initializePersistStore(
      APP_STORE_NAMES.customTestnet,
      {
        customTestnet: {},
        customTokenList: [],
        eip1559: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
    Object.values(this.store.customTestnet).forEach(chain => {
      const client = createClientByChain(chain);
      this.chains[chain.id] = client;
    });
    this.syncChainList();
    this.syncStore();
  };
  add = async (chain: TestnetChainBase) => {
    return this._update(chain, true);
  };

  update = async (chain: TestnetChainBase) => {
    return this._update(chain);
  };

  _update = async (chain: TestnetChainBase, isAdd?: boolean) => {
    const local = findChain({
      id: +chain.id,
    });
    if (isAdd && local) {
      if (local.isTestnet) {
        return {
          error: {
            key: 'id',
            message: "You've already added this chain",
            status: 'alreadyAdded',
          },
        };
      } else {
        return {
          error: {
            key: 'id',
            message: 'Chain already integrated by Rabby Wallet',
            status: 'alreadySupported',
          },
        };
      }
    }
    try {
      const { data } = await axios.post(
        chain.rpcUrl,
        {
          jsonrpc: '2.0',
          id: getUniqueId(),
          method: 'eth_chainId',
        },
        {
          timeout: 6000,
        },
      );
      if (+data.result !== +chain.id) {
        return {
          error: {
            key: 'rpcUrl',
            message: 'RPC does not match the chainID',
          },
        };
      }
    } catch (error) {
      return {
        error: {
          key: 'rpcUrl',
          message: 'RPC invalid or currently unavailable',
        },
      };
    }

    const nextChain = createTestnetChain(chain);
    this.mutateStore(draft => {
      draft.customTestnet[chain.id] = nextChain;
    });
    this.chains[chain.id] = createClientByChain(chain);
    this.syncChainList();
    this.syncStore();
    // the RPC may have changed, check it again
    this.detectEip1559(chain.id).catch(e => {
      console.error(e);
    });

    return nextChain;
  };

  remove = (chainId: number) => {
    this.mutateStore(draft => {
      delete draft.customTestnet[chainId];
      draft.customTokenList = draft.customTokenList.filter(item => {
        return item.chainId !== chainId;
      });
      if (draft.eip1559) {
        delete draft.eip1559[chainId];
      }
    });
    delete this.chains[chainId];
    this.eip1559Detecting.delete(+chainId);
    this.syncChainList();
    this.syncStore();
  };

  getClient = (chainId: number) => {
    return this.chains[chainId];
  };

  getList = () => {
    return createTestnetChainList(this.store.customTestnet, this.store.eip1559);
  };

  /**
   * Checks the latest block for `baseFeePerGas` and records the result.
   * A failed check keeps the previous result, since the RPC may only be down
   * for now; a network that was never checked stays on legacy transactions.
   */
  private isEip1559Detected = (chainId: number) => {
    return !!this.store.eip1559?.[chainId]?.supported;
  };

  detectEip1559 = (chainId: number): Promise<boolean> => {
    const id = +chainId;
    const client = this.getClient(id);
    if (!client) {
      return Promise.resolve(this.isEip1559Detected(id));
    }
    const pending = this.eip1559Detecting.get(id);
    if (pending?.client === client) {
      return pending.task;
    }
    const task = this._detectEip1559(id, client).finally(() => {
      if (this.eip1559Detecting.get(id)?.task === task) {
        this.eip1559Detecting.delete(id);
      }
    });
    this.eip1559Detecting.set(id, { client, task });
    return task;
  };

  private _detectEip1559 = async (chainId: number, client: Client) => {
    let supported: boolean;
    try {
      const block = await getBlock(client);
      supported = typeof block.baseFeePerGas === 'bigint';
    } catch (e) {
      console.error(e);
      return this.isEip1559Detected(chainId);
    }
    const previous = this.isEip1559Detected(chainId);
    // removed, or its RPC replaced, while the request was in flight
    if (
      !this.store.customTestnet[chainId] ||
      this.getClient(chainId) !== client
    ) {
      return previous;
    }
    this.mutateStore(draft => {
      draft.eip1559 = {
        ...draft.eip1559,
        [chainId]: {
          supported,
          checkedAt: Date.now(),
        },
      };
    });
    if (previous !== supported) {
      this.syncChainList();
    }
    return supported;
  };

  /**
   * Whether the network supports EIP-1559. A result checked in the last 24h
   * is reused; otherwise the network is checked again, falling back to the
   * previous result when the RPC is slow or down.
   */
  getEip1559Support = async (chainId: number) => {
    const id = +chainId;
    const detection = this.store.eip1559?.[id];
    if (
      detection &&
      Date.now() - detection.checkedAt < EIP1559_RECHECK_INTERVAL
    ) {
      return detection.supported;
    }
    return withTimeoutFallback(
      this.detectEip1559(id),
      EIP1559_DETECT_TIMEOUT,
      !!detection?.supported,
    );
  };

  getTransactionReceipt = async ({
    chainId,
    hash,
  }: {
    chainId: number;
    hash: string;
  }) => {
    const client = this.getClient(+chainId);
    if (!client) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    const res = await getTransactionReceipt(client, {
      hash: hash as any,
    });
    return {
      ...res,
      status: res.status === 'success' ? '0x1' : '0x0',
    };
  };

  getTx = ({ hash, chainId }: { chainId: number; hash: string }) => {
    const chain = findChain({ id: chainId });
    if (!chain) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    return this.getTransactionReceipt({
      chainId: chain!.id,
      hash: hash,
    })
      .then(res => {
        return {
          ...res,
          hash: res.transactionHash,
          code: 0,
          status: parseInt(res.status, 16),
          gas_used: Number(res.gasUsed),
          token: customTestnetTokenToTokenItem({
            amount: 0,
            symbol: chain.nativeTokenSymbol,
            decimals: chain.nativeTokenDecimals,
            id: chain.nativeTokenAddress,
            chainId: chain.id,
            rawAmount: '0',
          }),
        };
      })
      .catch(e => {
        return {
          hash: hash,
          code: -1,
          status: 0,
          gas_used: 0,
          token: customTestnetTokenToTokenItem({
            amount: 0,
            symbol: chain.nativeTokenSymbol,
            decimals: chain.nativeTokenDecimals,
            id: chain.nativeTokenAddress,
            chainId: chain.id,
            rawAmount: '0',
          }),
        };
      });
  };

  getTransactionCount = ({
    address,
    blockTag,
    chainId,
  }: {
    address: string;
    blockTag: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
    chainId: number;
  }) => {
    const client = this.getClient(+chainId);
    if (!client) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    return getTransactionCount(client, {
      address: address as any,
      blockTag,
    });
  };

  estimateGas = async ({
    address,
    tx,
    chainId,
  }: {
    address: string;
    tx: Tx;
    chainId: number;
  }) => {
    const client = this.getClient(+chainId);
    if (!client) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    const res = await estimateGas(client, {
      account: address as any,
      ...tx,
    } as any);
    return res.toString();
  };

  getGasPrice = async (chainId: number) => {
    const client = this.getClient(+chainId);
    if (!client) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    const res = await getGasPrice(client);
    return res.toString();
  };

  getGasMarket = async ({
    chainId,
    custom,
    eip1559,
  }: {
    chainId: number;
    custom?: number;
    /**
     * Whether the caller will sign a type-2 tx. Defaults to the network's
     * EIP-1559 support.
     */
    eip1559?: boolean;
  }): Promise<GasLevel[]> => {
    const use1559 = eip1559 ?? (await this.getEip1559Support(chainId));
    if (use1559) {
      try {
        return await this.getEip1559GasMarket({ chainId, custom });
      } catch (e) {
        console.error(e);
        // still sent as type-2: custom networks are never downgraded to legacy
        const levels = await this.getLegacyGasMarket({ chainId, custom });
        return levels.map(item => ({ ...item, priority_price: item.price }));
      }
    }
    return this.getLegacyGasMarket({ chainId, custom });
  };

  getEip1559GasMarket = async ({
    chainId,
    custom,
  }: {
    chainId: number;
    custom?: number;
  }) => {
    const client = this.getClient(+chainId);
    if (!client) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }
    // eth_maxPriorityFeePerGas, falling back to eth_gasPrice - baseFee
    const [block, maxPriorityFeePerGas] = await Promise.all([
      getBlock(client),
      estimateMaxPriorityFeePerGas(client),
    ]);
    if (typeof block.baseFeePerGas !== 'bigint') {
      throw new Error('Latest block has no baseFeePerGas');
    }
    const baseFee = new BigNumber(block.baseFeePerGas.toString());
    const tip = new BigNumber(maxPriorityFeePerGas.toString());

    const levels = EIP1559_GAS_LEVELS.map(item => {
      const priorityPrice = tip
        .multipliedBy(item.priorityFeeMultiplier)
        .integerValue(BigNumber.ROUND_CEIL);
      return {
        level: item.level,
        price: baseFee
          .multipliedBy(item.baseFeeMultiplier)
          .integerValue(BigNumber.ROUND_CEIL)
          .plus(priorityPrice)
          .toNumber(),
        priority_price: priorityPrice.toNumber(),
        base_fee: baseFee.toNumber(),
        front_tx_count: 0,
        estimated_seconds: 0,
      };
    });

    return levels.concat([
      {
        level: 'custom',
        price: custom || 0,
        priority_price: Math.min(tip.toNumber(), custom || 0),
        base_fee: baseFee.toNumber(),
        front_tx_count: 0,
        estimated_seconds: 0,
      },
    ]) as GasLevel[];
  };

  getLegacyGasMarket = async ({
    chainId,
    custom,
  }: {
    chainId: number;
    custom?: number;
  }) => {
    // const SETTINGS_BY_PRIORITY_LEVEL = {
    //   low: {
    //     percentile: 10 as Percentile,
    //     baseFeePercentageMultiplier: new BN(110),
    //     priorityFeePercentageMultiplier: new BN(94),
    //     minSuggestedMaxPriorityFeePerGas: new BN(1_000_000_000),
    //     estimatedWaitTimes: {
    //       minWaitTimeEstimate: 15_000,
    //       maxWaitTimeEstimate: 30_000,
    //     },
    //   },
    //   medium: {
    //     percentile: 20 as Percentile,
    //     baseFeePercentageMultiplier: new BN(120),
    //     priorityFeePercentageMultiplier: new BN(97),
    //     minSuggestedMaxPriorityFeePerGas: new BN(1_500_000_000),
    //     estimatedWaitTimes: {
    //       minWaitTimeEstimate: 15_000,
    //       maxWaitTimeEstimate: 45_000,
    //     },
    //   },
    //   high: {
    //     percentile: 30 as Percentile,
    //     baseFeePercentageMultiplier: new BN(125),
    //     priorityFeePercentageMultiplier: new BN(98),
    //     minSuggestedMaxPriorityFeePerGas: new BN(2_000_000_000),
    //     estimatedWaitTimes: {
    //       minWaitTimeEstimate: 15_000,
    //       maxWaitTimeEstimate: 60_000,
    //     },
    //   },
    // };

    const gasPrice = await this.getGasPrice(chainId);

    const levels = [
      {
        level: 'slow',
        baseFeePercentageMultiplier: 110,
        priorityFeePercentageMultiplier: 94,
      },
      {
        level: 'normal',
        baseFeePercentageMultiplier: 120,
        priorityFeePercentageMultiplier: 97,
      },
      {
        level: 'fast',
        baseFeePercentageMultiplier: 125,
        priorityFeePercentageMultiplier: 98,
      },
    ];

    return levels
      .map(item => {
        return {
          level: item.level,
          price: new BigNumber(gasPrice)
            .multipliedBy(item.baseFeePercentageMultiplier)
            .div(100)
            .integerValue()
            .toNumber(),
          priority_price: Math.round(
            new BigNumber(gasPrice)
              .multipliedBy(item.priorityFeePercentageMultiplier)
              .div(100)
              .integerValue()
              .toNumber(),
          ),
          front_tx_count: 0,
          estimated_seconds: 0,
        };
      })
      .concat([
        {
          level: 'custom',
          price: custom || 0,
          priority_price: custom || 0,
          front_tx_count: 0,
          estimated_seconds: 0,
        },
      ]) as GasLevel[];
  };

  addToken = (params: CustomTestnetTokenBase) => {
    if (this.hasToken(params)) {
      throw new Error('Token already added');
    }
    this.mutateStore(draft => {
      draft.customTokenList.push(params);
    });
    this.syncStore();
  };

  removeToken = (params: Pick<CustomTestnetTokenBase, 'chainId' | 'id'>) => {
    this.mutateStore(draft => {
      draft.customTokenList = draft.customTokenList.filter(item => {
        return !isSameTestnetToken(item, params);
      });
    });
    this.syncStore();
  };

  hasToken = (params: Pick<CustomTestnetTokenBase, 'id' | 'chainId'>) => {
    return !!this.store.customTokenList.find(item => {
      return isSameTestnetToken(params, item);
    });
  };

  getTokenOnAllChains = async ({
    address,
    tokenId,
  }: {
    address: string;
    tokenId: string;
  }) => {
    const chainList = Object.values(this.store.customTestnet).map(item => {
      return item.id;
    });
    const res = await Promise.all(
      chainList.map(chainId => {
        return this.getToken({
          chainId,
          address,
          tokenId,
        }).catch(e => {
          console.error(e);
          return null;
        });
      }),
    );
    const result = res.filter((item): item is CustomTestnetToken => !!item);
    return result;
  };
  getToken = async ({
    chainId,
    address,
    tokenId,
  }: {
    chainId: number;
    address: string;
    tokenId?: string | null;
  }) => {
    const [balance, tokenInfo] = await Promise.all([
      this.getBalance({
        chainId,
        address,
        tokenId,
      }),
      this.getTokenInfo({
        chainId,
        tokenId,
      }),
    ]);

    const { decimals } = tokenInfo;

    return {
      ...tokenInfo,
      amount: new BigNumber(balance.toString()).div(10 ** decimals).toNumber(),
      rawAmount: balance.toString(),
    };
  };

  getBalance = async ({
    chainId,
    address,
    tokenId,
  }: {
    chainId: number;
    address?: string;
    tokenId?: string | null;
  }) => {
    const client = this.getClient(+chainId);
    const chain = findChain({
      id: +chainId,
    });
    if (!client || !chain) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }

    if ((!tokenId || tokenId === chain.nativeTokenAddress) && address) {
      const balance = await getBalance(client, {
        address: address as `0x${string}`,
      });
      return balance;
    }

    const balance = !address
      ? 0n
      : await readContract(client, {
          address: tokenId as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        });

    return balance;
  };

  getTokenInfo = async ({
    chainId,
    tokenId,
  }: {
    chainId: number;
    tokenId?: string | null;
  }) => {
    const client = this.getClient(+chainId);
    const chain = findChain({
      id: +chainId,
    });
    if (!client || !chain) {
      throw new Error(`Invalid chainId: ${chainId}`);
    }

    if (!tokenId || tokenId === chain.nativeTokenAddress) {
      return {
        id: chain.nativeTokenAddress,
        symbol: chain.nativeTokenSymbol,
        chainId,
        decimals: chain.nativeTokenDecimals,
      };
    }

    const local = this.store.customTokenList?.find(item => {
      return isSameTestnetToken(item, {
        id: tokenId,
        chainId,
      });
    });
    if (local) {
      return cloneDeep(local);
    }

    // todo: multicall
    const [symbol, decimals] = await Promise.all([
      readContract(client, {
        address: tokenId as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      readContract(client, {
        address: tokenId as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

    return {
      id: tokenId,
      symbol: symbol,
      chainId,
      decimals,
    };
  };

  getTokenList = async ({
    address,
    chainId,
    q,
    isRemote,
  }: {
    address: string;
    chainId?: number;
    q?: string;
    isRemote?: boolean;
  }) => {
    const nativeTokenList = Object.values(this.store.customTestnet).map(
      item => {
        return {
          id: null,
          chainId: item.id,
          symbol: item.nativeTokenSymbol,
        };
      },
    );
    const list = cloneDeep(this.store.customTokenList || []);
    let tokenList = [...nativeTokenList, ...list];
    if (chainId) {
      tokenList = tokenList.filter(item => {
        return item.chainId === chainId;
      });
    }

    if (q) {
      tokenList = tokenList.filter(item => {
        return (
          item.id === q || item.symbol.toLowerCase().includes(q.toLowerCase())
        );
      });
    }
    let queryList = tokenList.map(item => {
      return {
        tokenId: item.id,
        chainId: item.chainId,
        address,
      };
    });

    if (q && isAddress(q) && isRemote) {
      const chainList = chainId
        ? [chainId]
        : Object.values(this.store.customTestnet).map(item => item.id);

      queryList = chainList.map(chainId => {
        return {
          tokenId: q,
          chainId,
          address,
        };
      });
    }

    const res = await Promise.all(
      queryList.map(item =>
        withTimeoutFallback(this.getToken(item), 10000, null).catch(e => {
          console.error(e);
          return null;
        }),
      ),
    );
    const result = sortBy(
      res.filter((item): item is CustomTestnetToken => !!item),
      item => {
        return !item.id;
      },
      item => {
        return -item.amount;
      },
    );
    if (result.length <= 0 && q && isAddress(q)) {
      const tokens = await this.getTokenOnAllChains({
        tokenId: q,
        address,
      });
      return tokens;
    }
    return result;
  };

  // todo
  getTokenWithBalance = this.getTokenList;

  syncChainList = () => {
    const testnetList = this.getList();
    updateChainStore({
      testnetList: testnetList,
    });
  };

  syncStore = () => {
    syncCustomTestnetStore({
      customTestnet: this.getStoreFieldSnapshot('customTestnet'),
      customTokenList: this.getStoreFieldSnapshot('customTokenList'),
    });
  };
}

const createClientByChain = (chain: TestnetChainBase) => {
  return createClient({
    chain: defineChain({
      id: chain.id,
      name: chain.name,
      nativeCurrency: {
        symbol: chain.nativeTokenSymbol,
        name: chain.nativeTokenSymbol,
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [chain.rpcUrl],
        },
      },
    }),
    transport: http(chain.rpcUrl),
  });
};
