import { apiKeyring, apiMnemonic } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KeyringTypeName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const LedgerHDPathTypeLabel = {
  [LedgerHDPathType.LedgerLive]: 'Ledger Live',
  [LedgerHDPathType.BIP44]: 'BIP44',
  [LedgerHDPathType.Legacy]: 'Ledger Legacy',
} satisfies Record<LedgerHDPathType, string>;

export type AccountInfoValue = {
  address: string;
  hdPathType: LedgerHDPathType;
  hdPathTypeLabel: string;
  index: number;
};

type UseAccountInfoOptions = {
  autoFetch?: boolean;
};

type AccountInfoFetchKind =
  | 'keyring_account_info'
  | 'keyring_index'
  | 'mnemonic_address_info';

const getAccountInfoFetchKind = (
  type: KeyringTypeName,
  brand?: string,
): AccountInfoFetchKind | null => {
  const isLedger = type === KEYRING_CLASS.HARDWARE.LEDGER;
  const isTrezorLike =
    type === KEYRING_CLASS.HARDWARE.TREZOR ||
    type === KEYRING_CLASS.HARDWARE.ONEKEY;
  const isMnemonics = type === KEYRING_CLASS.MNEMONIC;
  const isKeystone = brand === 'Keystone';

  if (isLedger || isKeystone) {
    return 'keyring_account_info';
  }
  if (isTrezorLike) {
    return 'keyring_index';
  }
  if (isMnemonics) {
    return 'mnemonic_address_info';
  }

  return null;
};

const fetchAccountInfoByKind = async (
  type: KeyringTypeName,
  address: string,
  brand?: string,
): Promise<AccountInfoValue | undefined> => {
  const fetchKind = getAccountInfoFetchKind(type, brand);

  if (!fetchKind) {
    return undefined;
  }

  if (fetchKind === 'keyring_account_info') {
    const info = await apiKeyring.requestKeyring(
      type,
      'getAccountInfo',
      null,
      address,
    );

    return {
      ...info,
      address,
      hdPathTypeLabel: LedgerHDPathTypeLabel[info.hdPathType],
    };
  }

  if (fetchKind === 'keyring_index') {
    const index = await apiKeyring.requestKeyring(
      type,
      'indexFromAddress',
      null,
      address,
    );

    return {
      address,
      index: index + 1,
      hdPathType: LedgerHDPathType.BIP44,
      hdPathTypeLabel: LedgerHDPathTypeLabel.BIP44,
    };
  }

  const info = await apiMnemonic.getMnemonicAddressInfo(address);
  if (!info) {
    return undefined;
  }

  const hdPathType = info.hdPathType as unknown as LedgerHDPathType;

  return {
    address,
    index: info.index + 1,
    hdPathType,
    hdPathTypeLabel: LedgerHDPathTypeLabel[hdPathType],
  };
};

export const useAccountInfo = (
  type: KeyringTypeName,
  address: string,
  brand?: string,
  options?: UseAccountInfoOptions,
) => {
  const { autoFetch = true } = options || {};
  const [value, setValue] = useState<AccountInfoValue>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const requestSequenceRef = useRef(0);

  const fetchKind = useMemo(() => {
    return getAccountInfoFetchKind(type, brand);
  }, [brand, type]);
  const canFetch = !!address && !!type && !!fetchKind;
  const shouldDisplay =
    type === KEYRING_CLASS.HARDWARE.LEDGER ||
    type === KEYRING_CLASS.HARDWARE.TREZOR ||
    type === KEYRING_CLASS.HARDWARE.ONEKEY ||
    type === KEYRING_CLASS.MNEMONIC ||
    brand === 'Keystone';

  const fetchAccountInfo = useCallback(async () => {
    if (!canFetch) {
      setValue(undefined);
      setError(undefined);
      setIsLoading(false);
      return undefined;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsLoading(true);
    setError(undefined);

    try {
      const nextValue = await fetchAccountInfoByKind(type, address, brand);

      if (requestSequenceRef.current === requestId) {
        setValue(nextValue);
      }

      return nextValue;
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error('Fetch account info failed');

      if (requestSequenceRef.current === requestId) {
        setError(normalizedError);
      }

      throw normalizedError;
    } finally {
      if (requestSequenceRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [address, brand, canFetch, type]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setValue(undefined);
    setError(undefined);
    setIsLoading(false);

    if (!autoFetch || !canFetch) {
      return;
    }

    fetchAccountInfo().catch(() => null);
  }, [address, autoFetch, canFetch, brand, fetchAccountInfo, type]);

  return {
    value,
    isLoading,
    error,
    canFetch,
    fetchAccountInfo,
    shouldDisplay,
  };
};

export const useAccountsInfo = (
  type: KeyringTypeName,
  address: string,
  brand?: string,
) => {
  return useAccountInfo(type, address, brand).value;
};
