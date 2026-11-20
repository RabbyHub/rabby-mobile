/**
 * Non-production deep-link helpers for Perps performance work.
 *
 * Only used from `_cmd=debug-perps-account` links while
 * `isNonPublicProductionEnv` is true. Never reaches production builds' handlers.
 */
import { isNonPublicProductionEnv } from '@/constant';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import {
  perpsStore,
  switchPerpsAccountBeforeNavigate,
} from '@/hooks/perps/usePerpsStore';
import { runPreferredPerpsNavigation } from '@/hooks/perps/navigation/navigateToPreferredPerps';
import accountStore from '@/store/account';
import type { KeyringAccountWithAlias } from '@/types/account';
import { navigationRef } from '@/utils/navigation';
import { StackActions } from '@react-navigation/native';

export type PerpsDebugAction = 'state' | 'select';

const asAddress = (address?: string | null) => address || null;

function listAccounts(): KeyringAccountWithAlias[] {
  return accountStore.getState().accounts || [];
}

function findAccount(address: string) {
  const normalized = address.trim().toLowerCase();
  return listAccounts().find(
    account => account.address.toLowerCase() === normalized,
  );
}

function describeAccount(account: {
  address: string;
  type?: string;
  brandName?: string;
  aliasName?: string;
}) {
  return {
    address: asAddress(account.address),
    type: account.type || null,
    brandName: account.brandName || null,
    aliasName: account.aliasName || null,
  };
}

async function logPerpsState(source: string) {
  const state = perpsStore.getState();
  const clearinghouse = state.currentClearinghouseState;
  const homeFallbackAccount = getFallbackAccountSnapshot();
  const [currentAccount, lastUsedAccount] = await Promise.all([
    perpsServiceApi.getCurrentAccount().catch(() => null),
    perpsServiceApi.getLastUsedAccount().catch(() => null),
  ]);

  console.info('[PerpsDebug] state snapshot', {
    source,
    accounts: listAccounts().map(describeAccount),
    homeFallbackAccount: homeFallbackAccount
      ? describeAccount(homeFallbackAccount)
      : null,
    persistedPerpsCurrentAccount: currentAccount
      ? describeAccount(currentAccount)
      : null,
    persistedPerpsLastUsedAccount: lastUsedAccount
      ? describeAccount(lastUsedAccount)
      : null,
    storeCurrentPerpsAccount: state.currentPerpsAccount
      ? describeAccount(state.currentPerpsAccount)
      : null,
    storeIsLogin: state.isLogin,
    storeIsUserDataReady: state.isUserDataReady,
    storeOpenOrders: state.openOrders?.length ?? 0,
    storePositionCount: clearinghouse?.assetPositions?.length ?? 0,
    storeAccountValue: clearinghouse?.marginSummary?.accountValue ?? null,
  });
}

async function waitForNavigationReady(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (navigationRef.isReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

export async function runNonProductionPerpsDebugCommand(
  command: {
    action: PerpsDebugAction;
    address?: string;
    open?: boolean;
  },
  handlers: {
    openPerps: () => void;
  },
) {
  if (!isNonPublicProductionEnv) {
    return;
  }

  if (command.action === 'state') {
    console.info('[PerpsDebug] account list requested');
    await logPerpsState('deeplink-state');
    return;
  }

  const address = String(command.address || '').trim();
  if (!address) {
    console.warn('[PerpsDebug] select requires address');
    return;
  }

  const account = findAccount(address);
  if (!account) {
    console.warn('[PerpsDebug] account not found', {
      address: asAddress(address),
      known: listAccounts().map(item => item.address),
    });
    return;
  }

  console.info('[PerpsDebug] select account', describeAccount(account));

  if (command.open === false) {
    switchPerpsAccountBeforeNavigate(account);
    await logPerpsState('deeplink-select-persist-only');
    return;
  }

  const ready = await waitForNavigationReady();
  if (!ready) {
    console.warn('[PerpsDebug] navigation not ready, persisting only');
    switchPerpsAccountBeforeNavigate(account);
    return;
  }

  const result = await runPreferredPerpsNavigation({
    account,
    navigation: {
      push: (name, params) =>
        navigationRef.dispatch(StackActions.push(name, params)),
    } as never,
    source: 'debug-perps-account-deeplink',
  });
  console.info('[PerpsDebug] navigation result', { result });
  if (result === false) {
    handlers.openPerps();
  }
}
