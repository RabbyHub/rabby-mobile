import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { CHAINS_ENUM } from '@/constant/chains';
import { openapi } from '@/core/request';
import { AutoConnectService } from './autoConnect';
import { DappService } from './dappService';

function createMemoryStorage(): StorageAdapater {
  const values = new Map<string, string>();
  return {
    getItem: key => {
      const value = values.get(String(key));
      return value === undefined ? null : JSON.parse(value);
    },
    setItem: (key, value) => {
      values.set(String(key), JSON.stringify(value));
    },
    removeItem: key => values.delete(String(key)),
    clearAll: () => values.clear(),
  };
}

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
  aliasName: '',
};

function createAutoConnect(dappService: DappService) {
  return new AutoConnectService({
    dappService,
    getAccounts: async () => [account],
    getFallbackAccount: () => account,
    getRecentTransactions: () => [],
  });
}

describe('automatic connection permission integration', () => {
  beforeEach(() => {
    // Keep the real API client and replace only its HTTP boundary.
    jest
      .mocked(openapi.request.get)
      .mockReset()
      .mockResolvedValue({
        data: { collect_list: ['source-a', 'source-b'] },
      });
  });

  it('preserves first-time auto-connect eligibility without granting permission', async () => {
    const origin = 'https://first-visit.example';
    const dappService = new DappService({
      storageAdapter: createMemoryStorage(),
    });
    dappService.addDapp({ origin, name: 'Dapp', chainId: CHAINS_ENUM.ETH });
    const service = createAutoConnect(dappService);
    await expect(service.autoConnect(origin)).resolves.toEqual({
      defaultAccount: account,
      defaultChain: CHAINS_ENUM.ETH,
    });
    expect(dappService.hasPermission(origin)).toBe(false);
  });

  it('retains disconnection after account replacement and storage reconstruction', async () => {
    const origin = 'https://disconnected.example';
    const storageAdapter = createMemoryStorage();
    const dappService = new DappService({ storageAdapter });
    dappService.addDapp({
      origin,
      name: 'Dapp',
      chainId: CHAINS_ENUM.ETH,
      currentAccount: account,
      isConnected: true,
    });
    dappService.disconnect(origin);
    dappService.updateDapp({
      ...dappService.getDapp(origin)!,
      currentAccount: {
        ...account,
        address: '0x2222222222222222222222222222222222222222',
      },
    });
    dappService.persistStoreImmediately();
    const restored = new DappService({ storageAdapter });
    const service = createAutoConnect(restored);
    await expect(service.autoConnect(origin)).resolves.toBeUndefined();
    await service.prepare(origin);
    expect(restored.hasPermission(origin)).toBe(false);
    expect(restored.getDapp(origin)?.isConnected).toBe(false);
    expect(openapi.request.get).not.toHaveBeenCalled();
  });
});
