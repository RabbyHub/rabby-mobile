import axios from 'axios';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import type { SupportedChain } from '@rabby-wallet/rabby-api/dist/types';

// This integration test intentionally composes the real dapp, session and
// chain-sync services with the real chain store; only the network is replaced.
import { CHAINS_ENUM, getChainList, updateChainStore } from '@/constant/chains';
import { BroadcastEvent } from '@/constant/event';
import { DappService, type DappInfo } from '@/core/services/dappService';
import { registerService } from '@/core/services/serviceRegistry';
import { SessionService } from '@/core/services/session';
import { SyncChainService } from '@/core/services/syncChainService';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { supportedChainToChain } from '@/isomorphic/chain';
import { useCustomTestnetStore } from '@/store/customTestnet';
import { hasDappPermissionSnapshot } from './dapp';
import { disconnectDappsWithUnsupportedChain } from './dappUnsupportedChain';

function createSerializedMemoryStorage(): StorageAdapater {
  const values = new Map<string, string>();

  return {
    getItem: key => {
      const value = values.get(String(key));
      return value === undefined ? null : JSON.parse(value);
    },
    setItem: (key, value) => {
      values.set(String(key), JSON.stringify(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => values.clear(),
  };
}

const supportedChain = (id: string, communityId: number, name: string) => ({
  id,
  community_id: communityId,
  name,
  native_token: { id, symbol: name, logo: '', decimals: 18 },
  logo_url: '',
  white_logo_url: '',
  explorer_host: `https://${id}.example`,
  eip_1559: true,
  need_estimate_gas: false,
  is_disabled: false,
  severity: 0,
});

const ETH_CHAIN = supportedChain('eth', 1, 'Ethereum');
const BSC_CHAIN = supportedChain('bsc', 56, 'BNB Chain');
// not in the bundled list, so it only exists once a synced list has it
const NEW_CHAIN = supportedChain('rabbynewchain', 987654321, 'New Chain');
const NEW_CHAIN_ENUM = 'RABBYNEWCHAIN' as CHAINS_ENUM;
// in neither the bundled list nor any synced one
const GONE_CHAIN_ENUM = 'RABBYGONECHAIN' as CHAINS_ENUM;

const mockNextChainList = (chains: ReturnType<typeof supportedChain>[]) => {
  jest.mocked(axios.get).mockResolvedValueOnce({ data: chains });
};

const createDapp = (
  origin: string,
  chainId: CHAINS_ENUM,
  extra?: Partial<DappInfo>,
): DappInfo => ({
  origin,
  name: origin,
  chainId,
  isConnected: true,
  ...extra,
});

const originalMainnetList = getChainList('mainnet');
const originalTestnetList = getChainList('testnet');
const cleanups: Array<() => void> = [];

function setUpServices(dapps: DappInfo[]) {
  const dappStorage = createSerializedMemoryStorage();
  const dappService = new DappService({ storageAdapter: dappStorage });
  dappService.addDapp(dapps);
  const sessionService = new SessionService({ dappService });
  cleanups.push(registerService('dappService', dappService));
  cleanups.push(registerService('sessionService', sessionService));

  const openDappSession = (origin: string) => {
    const postMessage = jest.fn();
    const key = { port: { postMessage } };
    sessionService.getOrCreateSession(key)!.setProp({
      origin,
      name: origin,
      icon: '',
    });
    cleanups.push(() => sessionService.deleteSession(key));
    return () =>
      postMessage.mock.calls.map(([message]) => message.data) as unknown[];
  };

  // as its loader does: restore the cached list, register, then reconcile
  const startChainSync = (
    cachedChains: ReturnType<typeof supportedChain>[],
  ) => {
    const syncStorage = createSerializedMemoryStorage();
    syncStorage.setItem(APP_STORE_NAMES.syncChain, {
      data: {
        chains: cachedChains.map(chain =>
          supportedChainToChain(chain as SupportedChain),
        ),
        updatedAt: Date.now(),
      },
    });
    const service = new SyncChainService({
      storageAdapter: syncStorage,
      onMainnetChainListUpdated: disconnectDappsWithUnsupportedChain,
    });
    cleanups.push(() => service.timer && clearInterval(service.timer));
    cleanups.push(registerService('syncChainService', service));
    disconnectDappsWithUnsupportedChain();
    return service;
  };

  return { dappService, dappStorage, openDappSession, startChainSync };
}

describe('dapps on a chain removed from the chain list', () => {
  beforeEach(() => {
    useCustomTestnetStore.getState().setHydrationState('pending');
    appStorage.removeItem(APP_STORE_NAMES.customTestnet);
  });

  afterEach(() => {
    cleanups
      .splice(0)
      .reverse()
      .forEach(cleanup => cleanup());
    updateChainStore({
      mainnetList: originalMainnetList,
      testnetList: originalTestnetList,
    });
    jest.mocked(axios.get).mockReset();
  });

  it('disconnects and notifies them after a sync drops their chain, keeping their other data', async () => {
    const { dappService, dappStorage, openDappSession, startChainSync } =
      setUpServices([
        createDapp('https://gone.example', NEW_CHAIN_ENUM, {
          isFavorite: true,
          favoriteAt: 1,
        }),
        createDapp('https://idle.example', NEW_CHAIN_ENUM, {
          isConnected: false,
        }),
        createDapp('https://bsc.example', CHAINS_ENUM.BSC),
      ]);
    const syncChainService = startChainSync([ETH_CHAIN, BSC_CHAIN, NEW_CHAIN]);

    expect(dappService.getDapp('https://gone.example')).toMatchObject({
      chainId: NEW_CHAIN_ENUM,
      isConnected: true,
    });

    const goneMessages = openDappSession('https://gone.example');
    const bscMessages = openDappSession('https://bsc.example');
    mockNextChainList([ETH_CHAIN, BSC_CHAIN]);
    await syncChainService.syncMainnetChainList({ force: true });

    expect(goneMessages()).toEqual([
      { method: BroadcastEvent.accountsChanged, params: [] },
      {
        method: BroadcastEvent.chainChanged,
        params: { chainId: '0x1', networkVersion: '1' },
      },
    ]);
    expect(bscMessages()).toEqual([]);
    expect(hasDappPermissionSnapshot('https://gone.example')).toBe(false);
    expect(dappService.getDapp('https://gone.example')).toMatchObject({
      chainId: CHAINS_ENUM.ETH,
      isConnected: false,
      isFavorite: true,
      favoriteAt: 1,
    });
    expect(dappService.getDapp('https://idle.example')).toMatchObject({
      chainId: CHAINS_ENUM.ETH,
      isConnected: false,
    });
    expect(dappService.getDapp('https://bsc.example')).toMatchObject({
      chainId: CHAINS_ENUM.BSC,
      isConnected: true,
    });
    // entries without a chain that were never connected are left alone
    expect(dappService.getDapp('https://www.google.com')?.chainId).toBe(
      undefined,
    );

    dappService.persistStoreImmediately();
    expect(
      new DappService({ storageAdapter: dappStorage }).getDapp(
        'https://gone.example',
      ),
    ).toMatchObject({ chainId: CHAINS_ENUM.ETH, isConnected: false });
    expect(disconnectDappsWithUnsupportedChain()).toEqual([]);
  });

  it('waits for the synced chain list before judging a chain unsupported', async () => {
    const { dappService, startChainSync } = setUpServices([
      createDapp('https://new.example', NEW_CHAIN_ENUM),
    ]);

    // only the bundled list is known, which does not have the new chain yet
    expect(disconnectDappsWithUnsupportedChain()).toEqual([]);
    expect(dappService.getDapp('https://new.example')).toMatchObject({
      chainId: NEW_CHAIN_ENUM,
      isConnected: true,
    });

    const syncChainService = startChainSync([ETH_CHAIN, NEW_CHAIN]);
    mockNextChainList([ETH_CHAIN, NEW_CHAIN]);
    await syncChainService.syncMainnetChainList({ force: true });

    expect(dappService.getDapp('https://new.example')).toMatchObject({
      chainId: NEW_CHAIN_ENUM,
      isConnected: true,
    });
  });

  it('waits for the first fetch when no chain list was cached', async () => {
    const { dappService, startChainSync } = setUpServices([
      createDapp('https://new.example', NEW_CHAIN_ENUM),
      createDapp('https://gone.example', GONE_CHAIN_ENUM),
    ]);
    let respond!: (chains: ReturnType<typeof supportedChain>[]) => void;
    jest.mocked(axios.get).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          respond = chains => resolve({ data: chains });
        }) as never,
    );

    // registered while the first fetch is pending: only the bundled list
    const syncChainService = startChainSync([]);
    expect(dappService.getDapp('https://new.example')).toMatchObject({
      chainId: NEW_CHAIN_ENUM,
      isConnected: true,
    });
    expect(dappService.getDapp('https://gone.example')).toMatchObject({
      chainId: GONE_CHAIN_ENUM,
      isConnected: true,
    });

    respond([ETH_CHAIN, NEW_CHAIN]);
    await syncChainService.syncMainnetChainList();

    expect(dappService.getDapp('https://new.example')).toMatchObject({
      chainId: NEW_CHAIN_ENUM,
      isConnected: true,
    });
    expect(dappService.getDapp('https://gone.example')).toMatchObject({
      chainId: CHAINS_ENUM.ETH,
      isConnected: false,
    });
  });

  it('ignores a synced list without ETH instead of disconnecting every dapp', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { dappService, startChainSync } = setUpServices([
      createDapp('https://bsc.example', CHAINS_ENUM.BSC),
    ]);
    const syncChainService = startChainSync([ETH_CHAIN, BSC_CHAIN]);

    try {
      mockNextChainList([]);
      await syncChainService.syncMainnetChainList({ force: true });
    } finally {
      consoleError.mockRestore();
    }

    expect(dappService.getDapp('https://bsc.example')).toMatchObject({
      chainId: CHAINS_ENUM.BSC,
      isConnected: true,
    });
    expect(getChainList('mainnet').map(chain => chain.enum)).toEqual([
      CHAINS_ENUM.ETH,
      CHAINS_ENUM.BSC,
    ]);
  });

  it('keeps dapps on a saved custom network even before the networks were loaded', async () => {
    appStorage.setItem(APP_STORE_NAMES.customTestnet, {
      customTestnet: {
        424242: {
          id: 424242,
          name: 'Local',
          nativeTokenSymbol: 'ETH',
          rpcUrl: 'http://127.0.0.1:8545',
        },
      },
      customTokenList: [],
    });
    const { dappService, startChainSync } = setUpServices([
      createDapp('https://local.example', 'CUSTOM_424242' as CHAINS_ENUM),
      createDapp('https://deleted.example', 'CUSTOM_434343' as CHAINS_ENUM),
    ]);
    startChainSync([ETH_CHAIN]);

    expect(dappService.getDapp('https://local.example')).toMatchObject({
      chainId: 'CUSTOM_424242',
      isConnected: true,
    });
    expect(dappService.getDapp('https://deleted.example')).toMatchObject({
      chainId: CHAINS_ENUM.ETH,
      isConnected: false,
    });
  });
});
