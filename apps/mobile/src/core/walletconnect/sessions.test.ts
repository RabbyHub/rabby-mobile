import type { Account } from '@/types/account';
import { getAllAccountsToDisplay } from '@/core/apis/account';
import {
  getWalletConnectSessionOrigin,
  resolveWalletConnectAccount,
} from './sessions';

jest.mock('@/core/apis/account', () => ({
  getAllAccountsToDisplay: jest.fn(),
}));

jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
}));

jest.mock('./chainAccount', () => ({
  getAddressFromCaip10: jest.fn((account: string) => account.split(':')[2]),
  getChainsFromNamespaces: jest.fn(() => []),
  getMethodsFromNamespaces: jest.fn(() => []),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./state', () => ({
  setWalletConnectDebugState: jest.fn(),
}));

function createSession({ url, account }: { url?: string; account?: string }) {
  return {
    peer: {
      metadata: {
        url,
      },
    },
    namespaces: account
      ? {
          eip155: {
            accounts: [`eip155:1:${account}`],
          },
        }
      : {},
  } as never;
}

describe('walletconnect sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes session origin without inventing a fallback origin', () => {
    expect(
      getWalletConnectSessionOrigin(
        createSession({ url: 'https://example.com/path' }),
      ),
    ).toBe('https://example.com');
    expect(getWalletConnectSessionOrigin(createSession({}))).toBe('');
  });

  it('resolves approved accounts by address', async () => {
    const account = {
      address: '0xAbCd00000000000000000000000000000000AbCd',
      type: 'Ledger Hardware',
      brandName: 'Ledger',
    } as Account;

    jest.mocked(getAllAccountsToDisplay).mockResolvedValue([account]);

    await expect(
      resolveWalletConnectAccount(
        createSession({
          account: '0xabcd00000000000000000000000000000000abcd',
        }),
      ),
    ).resolves.toBe(account);
  });
});
