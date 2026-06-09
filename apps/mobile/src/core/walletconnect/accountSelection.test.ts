import type { Account } from '@/types/account';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { preferenceService } from '@/core/services';
import {
  forgetWalletConnectAccountForTopic,
  getWalletConnectAccountForTopic,
  getWalletConnectOriginFromUrl,
  isSameWalletConnectAccount,
  rememberWalletConnectAccountForOrigin,
  rememberWalletConnectAccountForTopic,
  selectWalletConnectAccountForOrigin,
} from './accountSelection';

const mockStorage = new Map<string, unknown>();

jest.mock('@/core/storage/mmkv', () => ({
  appStorage: {
    getItem: jest.fn((key: string) => mockStorage.get(key) || null),
    setItem: jest.fn((key: string, value: unknown) => {
      mockStorage.set(key, value);
    }),
  },
}));

jest.mock('@/core/services', () => ({
  preferenceService: {
    getPinAddresses: jest.fn(() => []),
    getFallbackAccount: jest.fn(() => null),
  },
}));

jest.mock('@/utils/sortAccountList', () => ({
  sortAccountList: jest.fn(
    (
      accounts: Account[],
      {
        highlightedAddresses = [],
      }: { highlightedAddresses?: { address: string; brandName: string }[] },
    ) => {
      const pinned: Account[] = [];
      const rest = [...accounts];

      highlightedAddresses.forEach(highlighted => {
        const index = rest.findIndex(
          account =>
            account.address.toLowerCase() ===
              highlighted.address.toLowerCase() &&
            account.brandName === highlighted.brandName,
        );
        if (index >= 0) {
          pinned.push(rest[index]);
          rest.splice(index, 1);
        }
      });

      return [...pinned, ...rest];
    },
  ),
}));

const firstSignable = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
} as Account;
const secondSignable = {
  address: '0x2222222222222222222222222222222222222222',
  type: 'HD Key Tree',
  brandName: 'Rabby',
} as Account;
const mixedCaseAddressAccount = {
  address: '0xAbCd00000000000000000000000000000000AbCd',
  type: 'Ledger Hardware',
  brandName: 'Ledger',
} as Account;
const sameAddressDifferentTypeAccount = {
  address: '0xabcd00000000000000000000000000000000abcd',
  type: 'HD Key Tree',
  brandName: 'Rabby',
} as Account;
const sameAddressSameTypeDifferentBrandAccount = {
  address: '0xabcd00000000000000000000000000000000abcd',
  type: 'Ledger Hardware',
  brandName: 'Other Ledger',
} as Account;

describe('walletconnect account selection', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.mocked(preferenceService.getPinAddresses).mockReturnValue([]);
    jest.mocked(preferenceService.getFallbackAccount).mockReturnValue(null);
  });

  it('selects the first my account from the account selector list when the dapp has not connected before', () => {
    const watchAccount = {
      address: '0x3333333333333333333333333333333333333333',
      type: 'Watch Address',
      brandName: 'Watch Address',
    } as Account;

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        watchAccount,
        firstSignable,
        secondSignable,
      ]),
    ).toEqual(firstSignable);
  });

  it('does not use safe or watch accounts as the account selector fallback', () => {
    const watchAccount = {
      address: '0x3333333333333333333333333333333333333333',
      type: 'Watch Address',
      brandName: 'Watch Address',
    } as Account;
    const safeAccount = {
      address: '0x4444444444444444444444444444444444444444',
      type: 'Gnosis',
      brandName: 'Gnosis',
    } as Account;
    jest
      .mocked(preferenceService.getFallbackAccount)
      .mockReturnValue(secondSignable);

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        watchAccount,
        safeAccount,
      ]),
    ).toBe(secondSignable);
  });

  it('uses pinned account ordering for the account selector fallback', () => {
    jest.mocked(preferenceService.getPinAddresses).mockReturnValue([
      {
        address: secondSignable.address,
        brandName: secondSignable.brandName,
      },
    ]);

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        secondSignable,
      ]),
    ).toEqual(secondSignable);
  });

  it('keeps the current account when it is still available', () => {
    rememberWalletConnectAccountForOrigin('https://example.com', firstSignable);

    expect(
      selectWalletConnectAccountForOrigin(
        'https://example.com',
        [firstSignable, secondSignable],
        secondSignable,
      ),
    ).toBe(secondSignable);
  });

  it('selects the last approved account for the same origin when it is still available', () => {
    rememberWalletConnectAccountForOrigin(
      'https://example.com',
      secondSignable,
    );

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        secondSignable,
      ]),
    ).toBe(secondSignable);
    expect(
      mockStorage.get(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS),
    ).toEqual({
      'https://example.com': {
        address: secondSignable.address,
        type: secondSignable.type,
        brandName: secondSignable.brandName,
      },
    });
  });

  it('matches remembered accounts by account identity', () => {
    mockStorage.set(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS, {
      'https://example.com': {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
        brandName: 'Ledger',
      },
    });

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        sameAddressSameTypeDifferentBrandAccount,
        sameAddressDifferentTypeAccount,
        mixedCaseAddressAccount,
      ]),
    ).toBe(mixedCaseAddressAccount);
  });

  it('keeps matching legacy remembered accounts without brandName by address and type', () => {
    mockStorage.set(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS, {
      'https://example.com': {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
      },
    });

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        sameAddressDifferentTypeAccount,
        mixedCaseAddressAccount,
      ]),
    ).toBe(mixedCaseAddressAccount);
  });

  it('does not select a different account type with the same remembered address', () => {
    mockStorage.set(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS, {
      'https://example.com': {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
        brandName: 'Ledger',
      },
    });

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        sameAddressDifferentTypeAccount,
      ]),
    ).toEqual(firstSignable);
  });

  it('falls back to the first account when the remembered account is gone', () => {
    mockStorage.set(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS, {
      'https://example.com': {
        address: '0x9999999999999999999999999999999999999999',
        type: 'Simple Key Pair',
      },
    });

    expect(
      selectWalletConnectAccountForOrigin('https://example.com', [
        firstSignable,
        secondSignable,
      ]),
    ).toEqual(firstSignable);
  });

  it('does not remember accounts without an origin', () => {
    rememberWalletConnectAccountForOrigin('', secondSignable);

    expect(
      mockStorage.get(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS),
    ).toBeUndefined();
  });

  it('remembers approved accounts by WalletConnect topic', () => {
    rememberWalletConnectAccountForTopic('topic-1', mixedCaseAddressAccount);

    expect(getWalletConnectAccountForTopic('topic-1')).toEqual({
      address: mixedCaseAddressAccount.address,
      type: mixedCaseAddressAccount.type,
      brandName: mixedCaseAddressAccount.brandName,
    });
    expect(
      mockStorage.get(
        APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
      ),
    ).toEqual({
      'topic-1': {
        address: mixedCaseAddressAccount.address,
        type: mixedCaseAddressAccount.type,
        brandName: mixedCaseAddressAccount.brandName,
      },
    });
  });

  it('forgets approved accounts by WalletConnect topic', () => {
    rememberWalletConnectAccountForTopic('topic-1', mixedCaseAddressAccount);

    forgetWalletConnectAccountForTopic('topic-1');

    expect(getWalletConnectAccountForTopic('topic-1')).toBeNull();
    expect(
      mockStorage.get(
        APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
      ),
    ).toEqual({});
  });

  it('compares approved WalletConnect accounts by account identity', () => {
    expect(
      isSameWalletConnectAccount(mixedCaseAddressAccount, {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
        brandName: 'Ledger',
      }),
    ).toBe(true);
    expect(
      isSameWalletConnectAccount(sameAddressDifferentTypeAccount, {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
        brandName: 'Ledger',
      }),
    ).toBe(false);
    expect(
      isSameWalletConnectAccount(sameAddressSameTypeDifferentBrandAccount, {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
        brandName: 'Ledger',
      }),
    ).toBe(false);
    expect(
      isSameWalletConnectAccount(sameAddressSameTypeDifferentBrandAccount, {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'Ledger Hardware',
      }),
    ).toBe(true);
  });

  it('normalizes origins without inventing a fallback origin', () => {
    expect(getWalletConnectOriginFromUrl('https://example.com/path')).toBe(
      'https://example.com',
    );
    expect(getWalletConnectOriginFromUrl('example.com/path')).toBe(
      'example.com/path',
    );
    expect(getWalletConnectOriginFromUrl()).toBe('');
  });
});
