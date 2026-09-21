import { renderHook } from '@testing-library/react-native';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import { syncSingleAddress } from '@/databases/hooks/history';
import type { Account } from '@/types/account';

import {
  getSafeHistorySyncAddress,
  useSyncSafeHistoryOnFocus,
} from './useSyncSafeHistoryOnFocus';

jest.mock('@/databases/hooks/history', () => ({
  syncSingleAddress: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react') as typeof import('react');

  return {
    useFocusEffect: (effect: React.EffectCallback) => {
      React.useEffect(effect, [effect]);
    },
  };
});

const mockedSyncSingleAddress = jest.mocked(syncSingleAddress);

const makeAccount = (type: string, address = '0xABC') =>
  ({
    address,
    brandName: type,
    type,
  } as Account);

describe('useSyncSafeHistoryOnFocus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSyncSingleAddress.mockResolvedValue(undefined);
  });

  it('returns a normalized Safe address only for single-address history', () => {
    const safeAccount = makeAccount(KEYRING_CLASS.GNOSIS);

    expect(
      getSafeHistorySyncAddress({
        account: safeAccount,
        isSceneUsingAllAccounts: false,
      }),
    ).toBe('0xabc');
    expect(
      getSafeHistorySyncAddress({
        account: safeAccount,
        isSceneUsingAllAccounts: true,
      }),
    ).toBeUndefined();
    expect(
      getSafeHistorySyncAddress({
        account: safeAccount,
        isInTokenDetail: true,
        isSceneUsingAllAccounts: false,
      }),
    ).toBeUndefined();
    expect(
      getSafeHistorySyncAddress({
        account: safeAccount,
        isSceneUsingAllAccounts: false,
        isTestnet: true,
      }),
    ).toBeUndefined();
    expect(
      getSafeHistorySyncAddress({
        account: makeAccount(KEYRING_CLASS.MNEMONIC),
        isSceneUsingAllAccounts: false,
      }),
    ).toBeUndefined();
  });

  it('syncs when entering Safe history', () => {
    const safeAccount = makeAccount(KEYRING_CLASS.GNOSIS);

    renderHook(() =>
      useSyncSafeHistoryOnFocus({
        account: safeAccount,
        isSceneUsingAllAccounts: false,
      }),
    );

    expect(mockedSyncSingleAddress).toHaveBeenCalledTimes(1);
    expect(mockedSyncSingleAddress).toHaveBeenCalledWith('0xabc');
  });

  it('syncs when the focused multi-history scene switches to a Safe', () => {
    const mnemonicAccount = makeAccount(KEYRING_CLASS.MNEMONIC);
    const safeAccount = makeAccount(KEYRING_CLASS.GNOSIS);
    const { rerender } = renderHook(
      ({ account }) =>
        useSyncSafeHistoryOnFocus({
          account,
          isSceneUsingAllAccounts: false,
        }),
      {
        initialProps: {
          account: mnemonicAccount,
        },
      },
    );

    expect(mockedSyncSingleAddress).not.toHaveBeenCalled();

    rerender({ account: safeAccount });

    expect(mockedSyncSingleAddress).toHaveBeenCalledTimes(1);
    expect(mockedSyncSingleAddress).toHaveBeenCalledWith('0xabc');

    rerender({ account: { ...safeAccount } });

    expect(mockedSyncSingleAddress).toHaveBeenCalledTimes(1);
  });
});
