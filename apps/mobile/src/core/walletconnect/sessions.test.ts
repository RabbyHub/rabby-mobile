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

jest.mock('./accountSelection', () => ({
  getWalletConnectAccountForTopic: jest.fn(() => null),
  isSameWalletConnectAccount: jest.fn(
    (
      account: Pick<Account, 'address' | 'type' | 'brandName'>,
      target?: Pick<Account, 'address' | 'type' | 'brandName'> | null,
    ) =>
      !!target &&
      account.address.toLowerCase() === target.address.toLowerCase() &&
      account.type === target.type &&
      account.brandName === target.brandName,
  ),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./state', () => ({
  setWalletConnectDebugState: jest.fn(),
}));

const { getWalletConnectAccountForTopic } = jest.requireMock(
  './accountSelection',
) as typeof import('./accountSelection');

function createSession({
  url,
  account,
  topic = 'topic-1',
}: {
  url?: string;
  account?: string;
  topic?: string;
}) {
  return {
    topic,
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
    jest.mocked(getWalletConnectAccountForTopic).mockReturnValue(null);
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

  it('resolves approved accounts by topic account identity before address fallback', async () => {
    const mnemonicAccount = {
      address: '0xAbCd00000000000000000000000000000000AbCd',
      type: 'HD Key Tree',
      brandName: 'Rabby',
    } as Account;
    const ledgerAccount = {
      address: '0xabcd00000000000000000000000000000000abcd',
      type: 'Ledger Hardware',
      brandName: 'Ledger',
    } as Account;
    jest.mocked(getWalletConnectAccountForTopic).mockReturnValue({
      address: ledgerAccount.address,
      type: ledgerAccount.type,
      brandName: ledgerAccount.brandName,
    });
    jest
      .mocked(getAllAccountsToDisplay)
      .mockResolvedValue([mnemonicAccount, ledgerAccount]);

    await expect(
      resolveWalletConnectAccount(
        createSession({
          account: '0xabcd00000000000000000000000000000000abcd',
        }),
      ),
    ).resolves.toBe(ledgerAccount);
  });

  it('does not fallback to the same address when topic account identity is missing locally', async () => {
    const mnemonicAccount = {
      address: '0xAbCd00000000000000000000000000000000AbCd',
      type: 'HD Key Tree',
      brandName: 'Rabby',
    } as Account;
    jest.mocked(getWalletConnectAccountForTopic).mockReturnValue({
      address: '0xabcd00000000000000000000000000000000abcd',
      type: 'Ledger Hardware',
      brandName: 'Ledger',
    });
    jest.mocked(getAllAccountsToDisplay).mockResolvedValue([mnemonicAccount]);

    await expect(
      resolveWalletConnectAccount(
        createSession({
          account: '0xabcd00000000000000000000000000000000abcd',
        }),
      ),
    ).resolves.toBeNull();
  });
});
