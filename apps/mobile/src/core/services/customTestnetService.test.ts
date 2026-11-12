jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
}));

jest.mock('@/utils/token', () => ({
  customTestnetTokenToTokenItem: jest.fn(token => token),
}));

jest.mock('@/constant/chains', () => ({
  updateChainStore: jest.fn(),
}));

jest.mock('@/store/customTestnet', () => ({
  syncCustomTestnetStore: jest.fn(),
}));

jest.mock('../storage/mmkv', () => ({ appStorage: undefined }));

jest.mock('viem/actions', () => ({
  estimateMaxPriorityFeePerGas: jest.fn(),
  getBlock: jest.fn(),
  getGasPrice: jest.fn(),
  getTransactionReceipt: jest.fn(),
}));

import { createClient, http } from 'viem';
import type { Block, TransactionReceipt } from 'viem';
import {
  estimateMaxPriorityFeePerGas,
  getBlock,
  getGasPrice,
  getTransactionReceipt,
} from 'viem/actions';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { updateChainStore } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import { createTestnetChain } from '@/core/utils/customTestnetChain';
import type { CustomTestnetEip1559Detection } from '@/types/customTestnet';
import {
  CustomTestnetService,
  type CutsomTestnetServiceStore,
} from './customTestnetService';

const hash = `0x${'ab'.repeat(32)}` as const;
const chain = createTestnetChain({
  id: 123456,
  name: 'Custom network',
  nativeTokenSymbol: 'ETH',
  rpcUrl: 'https://rpc.example',
});

describe('CustomTestnetService.getTx receipt status', () => {
  let service: CustomTestnetService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(findChain).mockReturnValue(chain);
    service = new CustomTestnetService();
    service.chains[chain.id] = createClient({ transport: http(chain.rpcUrl) });
  });

  it.each([
    ['success', 1],
    ['reverted', 0],
  ] as const)(
    'preserves a mined %s receipt as status %i',
    async (status, expectedStatus) => {
      jest.mocked(getTransactionReceipt).mockResolvedValue({
        transactionHash: hash,
        status,
        gasUsed: 21000n,
      } as TransactionReceipt);

      await expect(
        service.getTx({ chainId: chain.id, hash }),
      ).resolves.toMatchObject({
        hash,
        code: 0,
        status: expectedStatus,
        gas_used: 21000,
      });
    },
  );

  it('keeps an unavailable receipt unresolved instead of completing the transaction', async () => {
    jest
      .mocked(getTransactionReceipt)
      .mockRejectedValue(new Error('Receipt unavailable'));

    await expect(
      service.getTx({ chainId: chain.id, hash }),
    ).resolves.toMatchObject({
      hash,
      code: -1,
      status: 0,
      gas_used: 0,
    });
  });
});

const GWEI = 1_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const createService = (persisted?: Partial<CutsomTestnetServiceStore>) => {
  const storageAdapter: StorageAdapater = {
    getItem: jest.fn(() => ({
      customTestnet: { [chain.id]: chain },
      customTokenList: [],
      ...persisted,
    })),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
  const service = new CustomTestnetService({ storageAdapter });
  service.chains[chain.id] = createClient({ transport: http(chain.rpcUrl) });
  jest.mocked(updateChainStore).mockClear();
  return service;
};

const detected = (
  supported: boolean,
  checkedAt = Date.now(),
): Record<string, CustomTestnetEip1559Detection> => ({
  [chain.id]: { supported, checkedAt },
});

const mockLatestBlock = (baseFeePerGas?: bigint) =>
  jest.mocked(getBlock).mockResolvedValue({ baseFeePerGas } as Block);

const lastSyncedChain = () => {
  const calls = jest.mocked(updateChainStore).mock.calls;
  return calls[calls.length - 1]?.[0].testnetList?.[0];
};

describe('CustomTestnetService EIP-1559 detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a network persisted before detection existed on legacy', () => {
    const service = createService();

    expect(service.getStoreSnapshot().eip1559).toEqual({});
    expect(service.getList()[0].eip['1559']).toBe(false);
  });

  it('publishes a persisted result in the chain list', () => {
    const service = createService({ eip1559: detected(true) });

    expect(service.getList()[0].eip['1559']).toBe(true);
  });

  it('records support when the latest block has a base fee', async () => {
    const service = createService();
    mockLatestBlock(10n * BigInt(GWEI));

    await expect(service.detectEip1559(chain.id)).resolves.toBe(true);

    expect(service.getStoreSnapshot().eip1559[chain.id]).toMatchObject({
      supported: true,
    });
    expect(service.getList()[0].eip['1559']).toBe(true);
    expect(lastSyncedChain()?.eip['1559']).toBe(true);
  });

  it('records no support without a base fee and leaves the chain list alone', async () => {
    const service = createService();
    mockLatestBlock(undefined);

    await expect(service.detectEip1559(chain.id)).resolves.toBe(false);

    expect(service.getStoreSnapshot().eip1559[chain.id]).toMatchObject({
      supported: false,
    });
    expect(updateChainStore).not.toHaveBeenCalled();
  });

  it('keeps the previous result when the RPC fails', async () => {
    const checkedAt = Date.now() - 2 * DAY;
    const service = createService({ eip1559: detected(true, checkedAt) });
    jest.mocked(getBlock).mockRejectedValue(new Error('RPC down'));

    await expect(service.detectEip1559(chain.id)).resolves.toBe(true);

    expect(service.getStoreSnapshot().eip1559[chain.id]).toEqual({
      supported: true,
      checkedAt,
    });
  });

  it('shares one request between concurrent checks', async () => {
    const service = createService();
    mockLatestBlock(1n);

    await Promise.all([
      service.detectEip1559(chain.id),
      service.getEip1559Support(chain.id),
    ]);

    expect(getBlock).toHaveBeenCalledTimes(1);
  });

  it('reuses a result checked in the last day', async () => {
    const service = createService({ eip1559: detected(true) });

    await expect(service.getEip1559Support(chain.id)).resolves.toBe(true);
    expect(getBlock).not.toHaveBeenCalled();
  });

  it('checks a stale result again', async () => {
    const service = createService({
      eip1559: detected(true, Date.now() - 2 * DAY),
    });
    mockLatestBlock(undefined);

    await expect(service.getEip1559Support(chain.id)).resolves.toBe(false);
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(lastSyncedChain()?.eip['1559']).toBe(false);
  });

  it('drops the result when the network is removed', () => {
    const service = createService({ eip1559: detected(true) });

    service.remove(chain.id);

    expect(service.getStoreSnapshot().eip1559).toEqual({});
  });
});

describe('CustomTestnetService gas market', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(getGasPrice).mockResolvedValue(8n * BigInt(GWEI));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const legacyLevels = [
    { level: 'slow', price: 8.8 * GWEI },
    { level: 'normal', price: 9.6 * GWEI },
    { level: 'fast', price: 10 * GWEI },
  ];

  it('builds EIP-1559 levels from the base fee and tip', async () => {
    const service = createService({ eip1559: detected(true) });
    mockLatestBlock(10n * BigInt(GWEI));
    jest
      .mocked(estimateMaxPriorityFeePerGas)
      .mockResolvedValue(1n * BigInt(GWEI));

    const levels = await service.getGasMarket({
      chainId: chain.id,
      custom: 30 * GWEI,
    });

    expect(levels).toMatchObject([
      { level: 'slow', price: 13 * GWEI, priority_price: GWEI },
      { level: 'normal', price: 16 * GWEI, priority_price: GWEI },
      { level: 'fast', price: 21.5 * GWEI, priority_price: 1.5 * GWEI },
      { level: 'custom', price: 30 * GWEI, priority_price: GWEI },
    ]);
    levels.forEach(item => expect(item.base_fee).toBe(10 * GWEI));
  });

  it('falls back to gas price levels priced in full when the estimate fails', async () => {
    const service = createService({ eip1559: detected(true) });
    mockLatestBlock(10n * BigInt(GWEI));
    jest
      .mocked(estimateMaxPriorityFeePerGas)
      .mockRejectedValue(new Error('unsupported'));

    const levels = await service.getGasMarket({ chainId: chain.id });

    expect(levels.slice(0, 3)).toMatchObject(
      legacyLevels.map(item => ({ ...item, priority_price: item.price })),
    );
  });

  it('keeps the gas price market on a network without EIP-1559', async () => {
    const service = createService({ eip1559: detected(false) });

    const levels = await service.getGasMarket({ chainId: chain.id });

    expect(levels.slice(0, 3)).toMatchObject(legacyLevels);
    expect(getBlock).not.toHaveBeenCalled();
  });

  it('keeps the gas price market for a caller signing a legacy tx', async () => {
    const service = createService({ eip1559: detected(true) });

    const levels = await service.getGasMarket({
      chainId: chain.id,
      eip1559: false,
    });

    expect(levels.slice(0, 3)).toMatchObject(legacyLevels);
    expect(getBlock).not.toHaveBeenCalled();
  });
});
