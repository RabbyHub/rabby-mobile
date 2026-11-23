import type { DappInfo } from '@/core/services/dappService';

const mockGetDapp = jest.fn();
const mockPatchDapps = jest.fn();
const mockGetAccounts = jest.fn();

jest.mock('@/core/serviceApi/dapp', () => ({
  ensureDappServiceReady: jest.fn(),
  getDappSnapshot: () => mockGetDapp(),
  patchDappsSync: (...args: unknown[]) => mockPatchDapps(...args),
}));
jest.mock('./account', () => ({
  getAllAccountsToDisplay: () => mockGetAccounts(),
  sortAccountList: (accounts: unknown[]) => accounts,
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getPinnedAddressSnapshot: () => [],
}));
jest.mock('@/core/serviceApi/session', () => ({ sessionServiceApi: {} }));
jest.mock('../request', () => ({ openapi: {} }));
jest.mock('@/utils/chain', () => ({}));

import { connect } from './dapp';
import { CHAINS_ENUM } from '@/constant/chains';

const origin = 'https://dapp.example';
const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
};

describe('dapp connection commit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDapp.mockReturnValue({ origin });
    mockGetAccounts.mockResolvedValue([account]);
  });

  it('rejects automatic connection if disconnected while accounts were loading', async () => {
    let finish!: (accounts: unknown[]) => void;
    mockGetAccounts.mockImplementationOnce(
      () => new Promise(resolve => (finish = resolve)),
    );
    const pending = connect({
      origin,
      chainId: CHAINS_ENUM.ETH,
      isAutoConnect: true,
    });
    await Promise.resolve();
    mockGetDapp.mockReturnValue({ origin, isConnected: false });
    finish([account]);
    await expect(pending).rejects.toMatchObject({ code: 4100 });
    expect(mockPatchDapps).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, true],
    [undefined, false],
    [false, false],
  ])(
    'allows connection from %s (automatic: %s)',
    async (isConnected, isAutoConnect) => {
      mockGetDapp.mockReturnValue({ origin, isConnected } as Partial<DappInfo>);
      await connect({ origin, chainId: CHAINS_ENUM.ETH, isAutoConnect });
      expect(mockPatchDapps).toHaveBeenCalledWith({
        [origin]: expect.objectContaining({
          isConnected: true,
          currentAccount: account,
        }),
      });
    },
  );
});
