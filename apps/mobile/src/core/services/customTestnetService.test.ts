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
  getTransactionReceipt: jest.fn(),
}));

import { createClient, http } from 'viem';
import type { TransactionReceipt } from 'viem';
import { getTransactionReceipt } from 'viem/actions';
import { findChain } from '@/utils/chain';
import { createTestnetChain } from '@/core/utils/customTestnetChain';
import { CustomTestnetService } from './customTestnetService';

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
