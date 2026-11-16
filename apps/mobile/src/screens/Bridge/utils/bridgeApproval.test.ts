import type { Account } from '@/core/startupServices/preference';
import { getBridgeQuoteApproval } from './bridgeApproval';

const mockGetERC20Allowance = jest.fn();
jest.mock('@/core/apis/provider', () => ({
  getERC20Allowance: (...args: unknown[]) => mockGetERC20Allowance(...args),
}));
jest.mock('@debank/common', () => ({ CHAINS_ENUM: { ETH: 'ETH' } }));
jest.mock('@/utils/chain', () => ({
  findChain: ({ serverId }: { serverId: string }) =>
    serverId === 'eth'
      ? { enum: 'ETH', nativeTokenAddress: 'eth' }
      : { enum: 'BSC', nativeTokenAddress: 'bsc' },
}));
jest.mock('@/constant/swap', () => ({
  ETH_USDT_CONTRACT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
}));

const account = { address: '0xUser' } as unknown as Account;
const USDT = {
  id: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  chain: 'eth',
  decimals: 6,
};

describe('getBridgeQuoteApproval', () => {
  beforeEach(() => mockGetERC20Allowance.mockReset());

  it('needs no approval for native tokens or quotes without approve contract', async () => {
    const cache = new Map<string, Promise<string>>();
    await expect(
      getBridgeQuoteApproval({
        fromToken: { id: 'eth', chain: 'eth', decimals: 18 },
        approveContractId: '0xspender',
        amount: 1,
        account,
        allowanceCache: cache,
      }),
    ).resolves.toEqual({
      shouldApproveToken: false,
      shouldTwoStepApprove: false,
    });
    await expect(
      getBridgeQuoteApproval({
        fromToken: USDT,
        approveContractId: '',
        amount: 1,
        account,
        allowanceCache: cache,
      }),
    ).resolves.toEqual({
      shouldApproveToken: false,
      shouldTwoStepApprove: false,
    });
    expect(mockGetERC20Allowance).not.toHaveBeenCalled();
  });

  it('compares allowance with the raw amount and caches the request per key', async () => {
    mockGetERC20Allowance.mockResolvedValue('5000000');
    const cache = new Map<string, Promise<string>>();
    const params = {
      fromToken: { id: '0xtoken', chain: 'bsc', decimals: 6 },
      approveContractId: '0xspender',
      account,
      allowanceCache: cache,
    };
    await expect(
      getBridgeQuoteApproval({ ...params, amount: 5 }),
    ).resolves.toEqual({
      shouldApproveToken: false,
      shouldTwoStepApprove: false,
    });
    await expect(
      getBridgeQuoteApproval({ ...params, amount: 6 }),
    ).resolves.toEqual({
      shouldApproveToken: true,
      shouldTwoStepApprove: false,
    });
    expect(mockGetERC20Allowance).toHaveBeenCalledTimes(1);
  });

  it('asks for two-step approval for ETH USDT with a non-zero insufficient allowance', async () => {
    mockGetERC20Allowance.mockResolvedValue('1');
    await expect(
      getBridgeQuoteApproval({
        fromToken: USDT,
        approveContractId: '0xspender',
        amount: 10,
        account,
        allowanceCache: new Map(),
      }),
    ).resolves.toEqual({
      shouldApproveToken: true,
      shouldTwoStepApprove: true,
    });
  });
});
