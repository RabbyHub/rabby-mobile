jest.mock('@rabby-wallet/persist-store', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/utils/chain', () => ({
  findChainByEnum: jest.fn(),
}));

jest.mock('../request', () => ({
  openapi: {
    ethRpc: jest.fn(),
    getDefaultRPCs: jest.fn(() => Promise.resolve({ rpcs: [] })),
  },
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'https://rabby.io',
  isNonPublicProductionEnv: false,
}));

import { CustomRPCService } from './customRPCService';

const createService = (
  chainServerId: string,
  rpcUrls: string[],
): CustomRPCService => {
  const service = new CustomRPCService();
  service.store = {
    customRPC: {},
    defaultRPC: {
      [chainServerId]: {
        chainId: chainServerId,
        rpcUrl: rpcUrls,
        txPushToRPC: true,
      },
    },
  };
  service.preferredRPC = {};
  service.rpcProbeTasks = {};
  service.rpcStatus = {};
  return service;
};

describe('CustomRPCService preferred RPC', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not block submission and prefers the RPC at the highest block', async () => {
    const chainServerId = 'chain';
    const staleRPC = 'https://stale.example';
    const bestRPC = 'https://best.example';
    const service = createService(chainServerId, [staleRPC, bestRPC]);
    let resolveStaleBlock!: (blockNumber: string) => void;
    let resolveBestBlock!: (blockNumber: string) => void;
    const staleBlock = new Promise<string>(resolve => {
      resolveStaleBlock = resolve;
    });
    const bestBlock = new Promise<string>(resolve => {
      resolveBestBlock = resolve;
    });

    const request = jest
      .spyOn(service, 'defaultRPCRequest')
      .mockImplementation((url, method) => {
        if (method === 'eth_blockNumber') {
          return url === staleRPC ? staleBlock : bestBlock;
        }
        if (method === 'eth_sendRawTransaction') {
          return Promise.resolve('0xhash');
        }
        return Promise.resolve(url);
      });

    const probe = service.probeBestRPC(chainServerId);

    await expect(
      service.defaultRPCSubmitTxWithFallback(
        chainServerId,
        'eth_sendRawTransaction',
        ['0xraw'],
      ),
    ).resolves.toEqual(['0xhash', staleRPC]);

    resolveStaleBlock('0xf');
    resolveBestBlock('0x10');
    await probe;
    request.mockClear();

    await expect(
      service.defaultEthRPC({
        chainServerId,
        method: 'eth_sendRawTransaction',
        params: ['0xraw'],
      }),
    ).resolves.toBe('0xhash');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(staleRPC, 'eth_sendRawTransaction', [
      '0xraw',
    ]);
    request.mockClear();

    await expect(
      service.defaultEthRPC({
        chainServerId,
        method: 'eth_getTransactionReceipt',
        params: ['0xhash'],
      }),
    ).resolves.toBe(bestRPC);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(bestRPC, 'eth_getTransactionReceipt', [
      '0xhash',
    ]);
  });

  it('reuses one in-flight probe per chain', async () => {
    const chainServerId = 'chain';
    const firstRPC = 'https://first.example';
    const secondRPC = 'https://second.example';
    const service = createService(chainServerId, [firstRPC, secondRPC]);
    let resolveFirstBlock!: (blockNumber: string) => void;
    let resolveSecondBlock!: (blockNumber: string) => void;
    const firstBlock = new Promise<string>(resolve => {
      resolveFirstBlock = resolve;
    });
    const secondBlock = new Promise<string>(resolve => {
      resolveSecondBlock = resolve;
    });

    const request = jest
      .spyOn(service, 'defaultRPCRequest')
      .mockImplementation(url => (url === firstRPC ? firstBlock : secondBlock));

    const firstProbe = service.probeBestRPC(chainServerId);
    const reusedProbe = service.probeBestRPC(chainServerId);

    expect(reusedProbe).toBe(firstProbe);
    expect(request).toHaveBeenCalledTimes(2);

    resolveFirstBlock('0x30');
    resolveSecondBlock('0x40');
    await firstProbe;

    const nextProbe = service.probeBestRPC(chainServerId);
    expect(nextProbe).not.toBe(firstProbe);
    await nextProbe;
    expect(request).toHaveBeenCalledTimes(4);
  });
});
