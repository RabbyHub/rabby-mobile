import React from 'react';
import { act, render } from '@testing-library/react-native';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { Account, IPinAddress } from '@/types/account';
import { useSeedPhrase } from './useSeedPhrase';

type PublicKeyring = {
  type: string;
  publicKey: string;
  accounts: Array<{ address: string; brandName: string }>;
};
type Snapshot = {
  keyringRuntimeReady: boolean;
  keyrings: PublicKeyring[];
};
let mockSnapshot: Snapshot | undefined;
let mockAccounts: Account[] = [];
let mockPins: IPinAddress[] = [];
const mockAccountListeners = new Set<() => void>();
const mockMemListeners = new Set<(state: Snapshot) => void>();
const mockUseAccounts = jest.fn();
const mockUsePins = jest.fn();
const mockFetchAccounts = jest.fn();
const mockGetAllTypedAccounts = jest
  .fn()
  .mockImplementation(() => new Promise(() => {}));
const mockEnsureUnlocked = jest.fn();
const mockGetMnemonic = jest.fn();
const mockDeriveKeyring = jest.fn();
const mockPersistAccounts = jest.fn();
const mockStorePayload = jest.fn();
const mockUseWalletTypeData = jest.fn(() => ({ accountGroup: undefined }));
let mockDeferBinding = false;
let mockResolveBinding: (() => void) | undefined;
const mockSubscribe = (listener: () => void) => {
  mockAccountListeners.add(listener);
  return () => mockAccountListeners.delete(listener);
};

jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: {
    getAllTypedAccounts: (...args: unknown[]) =>
      mockGetAllTypedAccounts(...args),
  },
  getKeyringMemStoreStateSnapshot: () => mockSnapshot,
  bindKeyringMemStore: async (listener: (state: Snapshot) => void) => {
    mockMemListeners.add(listener);
    if (mockSnapshot) {
      listener(mockSnapshot);
    }
    const unsubscribe = () => mockMemListeners.delete(listener);
    return mockDeferBinding
      ? new Promise<() => boolean>(resolve => {
          mockResolveBinding = () => resolve(unsubscribe);
        })
      : unsubscribe;
  },
}));
jest.mock('@/hooks/account', () => ({
  useAccounts: (options: unknown) => {
    mockUseAccounts(options);
    return {
      accounts: require('react').useSyncExternalStore(
        mockSubscribe,
        () => mockAccounts,
      ),
      fetchAccounts: mockFetchAccounts,
    };
  },
  usePinAddresses: (options: unknown) => {
    mockUsePins(options);
    return {
      pinAddresses: require('react').useSyncExternalStore(
        mockSubscribe,
        () => mockPins,
      ),
    };
  },
}));
jest.mock('./useWalletTypeData', () => ({
  useWalletTypeData: () => mockUseWalletTypeData(),
}));
jest.mock('@/utils/account', () => ({
  sortAccountsByBalance: (accounts: Account[]) =>
    [...accounts].sort(
      (a, b) =>
        (b.balance || 0) - (a.balance || 0) ||
        a.address.toLowerCase().localeCompare(b.address.toLowerCase()) ||
        a.type.localeCompare(b.type) ||
        a.brandName.localeCompare(b.brandName),
    ),
}));
jest.mock('@/hooks/useEnterPassphraseModal', () => ({
  useEnterPassphraseModal: () => jest.fn(),
}));
jest.mock('@/core/apis', () => ({
  apiMnemonic: {
    getMnemonicKeyring: (...args: unknown[]) => mockGetMnemonic(...args),
    getKeyringByMnemonic: (...args: unknown[]) => mockDeriveKeyring(...args),
    getMnemonicKeyRingIdFromPublicKey: jest.fn(),
  },
}));
jest.mock('@/core/apis/mnemonic', () => ({
  activeAndPersistAccountsByMnemonics: (...args: unknown[]) =>
    mockPersistAccounts(...args),
}));
jest.mock('@/utils/navigation', () => ({
  navigateDeprecated: jest.fn(),
  replaceToFirst: jest.fn(),
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: (value: string) => value,
}));
jest.mock('@/core/serviceApi/contact', () => ({
  contactServiceApi: { setAlias: jest.fn() },
}));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: (...args: unknown[]) =>
    mockEnsureUnlocked(...args),
}));
jest.mock('@/core/utils/secretVault', () => ({
  storeMnemonicsPayload: (...args: unknown[]) => mockStorePayload(...args),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const account = (id: number, publicKey: string, balance = 0): Account => ({
  address: `0x${id.toString(16).padStart(40, '0')}`,
  type: KEYRING_TYPE.HdKeyring,
  brandName: KEYRING_TYPE.HdKeyring,
  publicKey,
  balance,
});
const group = (publicKey: string, accounts: Account[] = []): PublicKeyring => ({
  type: KEYRING_TYPE.HdKeyring,
  publicKey,
  accounts: accounts.map(({ address, brandName }) => ({ address, brandName })),
});
type Result = ReturnType<typeof useSeedPhrase>;
let latest: Result;
let first: Result | undefined;
function Probe() {
  latest = useSeedPhrase();
  first ||= latest;
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  first = undefined;
  mockAccounts = [];
  mockPins = [];
  mockSnapshot = undefined;
  mockDeferBinding = false;
  mockResolveBinding = undefined;
  mockAccountListeners.clear();
  mockMemListeners.clear();
});

// Component contracts: run the real hook and projection; fake only public store
// transport and service/action boundaries. No wallet or secret material exists.
it('renders ready public HD groups in the first render without loading keyring runtime', async () => {
  mockAccounts = [account(1, 'public-group-a', 10)];
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [group('public-group-a', mockAccounts)],
  };
  const view = render(<Probe />);
  expect(first?.seedPhraseList.map(item => item.publicKey)).toEqual([
    'public-group-a',
  ]);
  expect(first?.seedPhraseList[0].list.map(item => item.address)).toEqual([
    mockAccounts[0].address,
  ]);
  await act(async () => {});
  expect(mockUseAccounts).toHaveBeenCalledWith({ disableAutoFetch: true });
  expect(mockUsePins).toHaveBeenCalledWith({ disableAutoFetch: true });
  expect(mockUseWalletTypeData).not.toHaveBeenCalled();
  expect(mockGetAllTypedAccounts).not.toHaveBeenCalled();
  expect(mockFetchAccounts).not.toHaveBeenCalled();
  expect(mockEnsureUnlocked).not.toHaveBeenCalled();
  expect(mockGetMnemonic).not.toHaveBeenCalled();
  expect(mockDeriveKeyring).not.toHaveBeenCalled();
  expect(mockPersistAccounts).not.toHaveBeenCalled();
  expect(mockStorePayload).not.toHaveBeenCalled();
  view.unmount();
  expect(mockMemListeners.size).toBe(0);
  expect(mockAccountListeners.size).toBe(0);
});

it('keeps truly empty HD groups but never republishes fully hidden or non-HD groups', async () => {
  const visible = account(1, 'visible');
  const hidden = account(2, 'hidden');
  const stale = account(3, 'removed');
  mockAccounts = [visible, stale];
  const publicGroup = group('visible', [visible]);
  Object.defineProperty(publicGroup, 'keyring', {
    get: () => {
      throw new Error('metadata projection must not inspect keyring methods');
    },
  });
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [
      publicGroup,
      group('hidden', [hidden]),
      group('empty'),
      { ...group('non-hd'), type: KEYRING_TYPE.SimpleKeyring },
    ],
  };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual([
    'visible',
    'empty',
  ]);
  expect(latest.seedPhraseList[1].list).toEqual([]);
  expect(latest.seedPhraseList[1].brandName).toBe(KEYRING_TYPE.HdKeyring);
  expect(latest.seedPhraseList.every(item => !('keyring' in item))).toBe(true);
});

it('preserves group balance/count ordering, stable inventory ties, and pinned addresses within a group', async () => {
  const a = [account(1, 'a', 10), account(2, 'a', 1)];
  const b = [account(3, 'b', 11)];
  const c = [account(4, 'c', 12)];
  const d = [account(5, 'd', 11)];
  mockAccounts = [...a, ...b, ...c, ...d];
  mockPins = [{ address: a[1].address, brandName: a[1].brandName }];
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [group('d', d), group('b', b), group('a', a), group('c', c)],
  };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual([
    'c',
    'a',
    'd',
    'b',
  ]);
  expect(latest.seedPhraseList.map(item => item.index)).toEqual([0, 1, 2, 3]);
  expect(latest.seedPhraseList[1].list.map(item => item.address)).toEqual([
    a[1].address,
    a[0].address,
  ]);
});

it.each([undefined, { keyringRuntimeReady: false, keyrings: [] }])(
  'uses visible public account groups before runtime is ready (%s), without restoring it',
  async snapshot => {
    mockSnapshot = snapshot;
    mockAccounts = [account(1, 'public-snapshot', 1)];
    render(<Probe />);
    expect(first?.seedPhraseList.map(item => item.publicKey)).toEqual([
      'public-snapshot',
    ]);
    await act(async () => {});
    expect(mockGetAllTypedAccounts).not.toHaveBeenCalled();
    expect(mockEnsureUnlocked).not.toHaveBeenCalled();
    expect(mockGetMnemonic).not.toHaveBeenCalled();
    expect(mockDeriveKeyring).not.toHaveBeenCalled();
    expect(mockPersistAccounts).not.toHaveBeenCalled();
  },
);

it('reacts to public inventory deletion, visible account changes, and pin updates', async () => {
  const firstAccount = account(1, 'a', 10);
  const secondAccount = account(2, 'a', 1);
  const deletedAccount = account(3, 'b', 20);
  mockAccounts = [firstAccount, secondAccount, deletedAccount];
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [
      group('a', mockAccounts.slice(0, 2)),
      group('b', [deletedAccount]),
    ],
  };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual(['b', 'a']);
  act(() => {
    mockSnapshot = {
      keyringRuntimeReady: true,
      keyrings: [group('a', [firstAccount, secondAccount])],
    };
    mockMemListeners.forEach(listener => listener(mockSnapshot!));
  });
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual(['a']);
  act(() => {
    mockPins = [
      { address: secondAccount.address, brandName: secondAccount.brandName },
    ];
    mockAccountListeners.forEach(listener => listener());
  });
  expect(latest.seedPhraseList[0].list.map(item => item.address)).toEqual([
    secondAccount.address,
    firstAccount.address,
  ]);
  act(() => {
    mockAccounts = [secondAccount];
    mockAccountListeners.forEach(listener => listener());
  });
  expect(latest.seedPhraseList[0].list.map(item => item.address)).toEqual([
    secondAccount.address,
  ]);
  act(() => {
    mockAccounts = [];
    mockAccountListeners.forEach(listener => listener());
  });
  expect(latest.seedPhraseList).toEqual([]);
});

it('unsubscribes a binding that resolves after the consumer unmounts', async () => {
  mockDeferBinding = true;
  mockSnapshot = { keyringRuntimeReady: true, keyrings: [group('empty')] };
  const view = render(<Probe />);
  expect(mockMemListeners.size).toBe(1);
  view.unmount();
  await act(async () => {
    mockResolveBinding?.();
  });
  expect(mockMemListeners.size).toBe(0);
  expect(mockAccountListeners.size).toBe(0);
});

it('normalizes selected addresses like the previous display-account contract without mutating source accounts', async () => {
  const mixedCase = { ...account(1, 'mixed'), address: `0x${'A'.repeat(40)}` };
  mockAccounts = [mixedCase];
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [group('mixed', [mixedCase])],
  };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList[0].list[0].address).toBe(
    mixedCase.address.toLowerCase(),
  );
  expect(mockAccounts[0].address).toBe(`0x${'A'.repeat(40)}`);
});

it('pins only the first exact address/brand match, not every duplicate across HD groups', async () => {
  const a = [account(1, 'a', 1), account(2, 'a', 10)];
  const b = [account(1, 'b', 2), account(3, 'b', 20)];
  mockAccounts = [...a, ...b];
  mockPins = [{ address: a[0].address, brandName: a[0].brandName }];
  mockSnapshot = {
    keyringRuntimeReady: true,
    keyrings: [group('a', a), group('b', b)],
  };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual(['b', 'a']);
  expect(latest.seedPhraseList[0].list.map(item => item.address)).toEqual([
    b[0].address,
    b[1].address,
  ]);
  expect(latest.seedPhraseList[1].list.map(item => item.address)).toEqual([
    a[1].address,
    a[0].address,
  ]);
});

it('retains public account order for fallback ties, then respects an authoritative empty inventory', async () => {
  mockAccounts = [account(2, 'b', 1), account(1, 'a', 1)];
  mockSnapshot = { keyringRuntimeReady: false, keyrings: [] };
  render(<Probe />);
  await act(async () => {});
  expect(latest.seedPhraseList.map(item => item.publicKey)).toEqual(['b', 'a']);
  act(() => {
    mockSnapshot = { keyringRuntimeReady: true, keyrings: [] };
    mockMemListeners.forEach(listener => listener(mockSnapshot!));
  });
  expect(latest.seedPhraseList).toEqual([]);
  expect(mockGetAllTypedAccounts).not.toHaveBeenCalled();
});
