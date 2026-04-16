export type AccountBalanceSnapshot = {
  evmBalance?: number;
  totalBalance?: number;
};

export type AccountBalanceValueMap = Record<
  string,
  AccountBalanceSnapshot | undefined
>;

export type AccountBalanceSnapshotProvider = {
  getAddressValueMap(): AccountBalanceValueMap;
};

let accountBalanceSnapshotProvider: AccountBalanceSnapshotProvider | null =
  null;
let resolveAccountBalanceSnapshotProviderReady:
  | ((provider: AccountBalanceSnapshotProvider) => void)
  | null = null;
const accountBalanceSnapshotProviderReady =
  new Promise<AccountBalanceSnapshotProvider>(resolve => {
    resolveAccountBalanceSnapshotProviderReady = resolve;
  });

export function registerAccountBalanceSnapshotProvider(
  provider: AccountBalanceSnapshotProvider,
) {
  accountBalanceSnapshotProvider = provider;
  resolveAccountBalanceSnapshotProviderReady?.(provider);
  resolveAccountBalanceSnapshotProviderReady = null;
}

export function hasAccountBalanceSnapshotProvider() {
  return !!accountBalanceSnapshotProvider;
}

export function waitForAccountBalanceSnapshotProvider() {
  if (accountBalanceSnapshotProvider) {
    return Promise.resolve(accountBalanceSnapshotProvider);
  }

  return accountBalanceSnapshotProviderReady;
}

export function getAccountBalanceValueMap(): AccountBalanceValueMap {
  return accountBalanceSnapshotProvider?.getAddressValueMap() ?? {};
}
