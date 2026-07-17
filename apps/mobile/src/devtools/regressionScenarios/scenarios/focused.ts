import { CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import * as apisDapp from '@/core/apis/dapp';
import {
  getConnectedDappSnapshot,
  hasDappPermissionSnapshot,
} from '@/core/serviceApi/dapp';
import { browserApis } from '@/hooks/browser/useBrowser';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';
import {
  ensureScenarioWalletUnlocked,
  getScenarioAccounts,
  pushNestedScreen,
} from './utils';

async function prepareFocusedScenario(
  context: RegressionScenarioExecutionContext,
) {
  await context.waitForNavigation();
  await ensureScenarioWalletUnlocked();
  return getScenarioAccounts();
}

async function openDappBrowser(context: RegressionScenarioExecutionContext) {
  const requestedUrl = context.command.params.url || 'https://rabby.io';
  let url: URL;
  try {
    url = new URL(requestedUrl);
  } catch {
    throw new Error('Invalid Dapp URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Dapp browser regression only accepts HTTPS URLs');
  }

  const opened = browserApis.openTab(url.toString(), {
    isNewTab: true,
  });
  context.report('assertion', {
    assertion: 'dapp-browser-open-requested',
    passed: opened !== false,
    host: url.hostname,
  });
  if (opened === false) {
    throw new Error(`Unable to open Dapp URL: ${url.toString()}`);
  }
}

async function connectDappBrowser(
  context: RegressionScenarioExecutionContext,
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
) {
  const requestedUrl =
    context.command.params.url || 'https://tester.rabby.io';
  const url = new URL(requestedUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Dapp connect regression only accepts HTTPS URLs');
  }
  const origin = url.origin;
  const account = accounts.find(
    item =>
      item.type !== KEYRING_TYPE.WatchAddressKeyring &&
      item.type !== KEYRING_TYPE.GnosisKeyring,
  );
  if (!account) {
    throw new Error('Dapp connect scenario requires a self-owned account');
  }

  browserApis.openTab(url.toString(), {
    isDapp: true,
    isNewTab: true,
  });
  await apisDapp.connect({
    origin,
    chainId: CHAINS_ENUM.ETH,
    session: {
      origin,
      name: context.command.params.name || 'Rabby Regression Dapp',
      icon: '',
    },
    currentAccount: account,
  });

  const connected = getConnectedDappSnapshot(origin);
  const hasPermission = hasDappPermissionSnapshot(origin);
  const passed =
    hasPermission &&
    !!connected?.currentAccount?.address &&
    connected.currentAccount.address.toLowerCase() ===
      account.address.toLowerCase();

  context.report('assertion', {
    assertion: 'dapp-connected',
    passed,
    origin,
    account: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
    connectedAccount: connected?.currentAccount?.address
      ? `${connected.currentAccount.address.slice(
          0,
          6,
        )}...${connected.currentAccount.address.slice(-4)}`
      : null,
    hasPermission,
  });

  if (!passed) {
    throw new Error('Dapp permission did not converge after connect');
  }
}

async function openLendingMarkets(context: RegressionScenarioExecutionContext) {
  const { runNonProductionLendingDebugCommand } = await import(
    '@/screens/Lending/debugDeepLink'
  );
  const openLending = () =>
    pushNestedScreen(RootNames.StackTransaction, RootNames.Lending, {
      dappId: 'aave',
    });
  const requestedMarkets = (
    context.command.params.markets || 'core,plasma,megaeth'
  )
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  await runNonProductionLendingDebugCommand(
    {
      action: 'open',
      market: requestedMarkets[0],
    },
    { openLending },
  );
  await context.waitForRoute(RootNames.Lending);

  if (context.command.action === 'start') {
    for (const market of requestedMarkets) {
      await runNonProductionLendingDebugCommand(
        { action: 'probe', market },
        { openLending },
      );
      context.report('assertion', {
        assertion: 'lending-market-probed',
        passed: true,
        market,
      });
    }
  }
}

async function openPerps(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackTransaction, RootNames.Perps, {});
  await context.waitForRoute(RootNames.Perps);
  context.report('assertion', {
    assertion: 'perps-entry-opened',
    passed: true,
  });
}

async function openSyncExtensionPassword(
  context: RegressionScenarioExecutionContext,
) {
  pushNestedScreen(RootNames.StackAddress, RootNames.SyncExtensionPassword, {});
  await context.waitForRoute(RootNames.SyncExtensionPassword);
  context.report('assertion', {
    assertion: 'sync-extension-password-opened',
    passed: true,
  });
}

async function openTransactionHistory(
  context: RegressionScenarioExecutionContext,
) {
  pushNestedScreen(
    RootNames.StackTransaction,
    RootNames.MultiAddressHistory,
    {},
  );
  await context.waitForRoute(RootNames.MultiAddressHistory);
  context.report('assertion', {
    assertion: 'transaction-history-opened',
    passed: true,
  });
}

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  const accounts = await prepareFocusedScenario(context);
  switch (context.command.scenario) {
    case 'dapp-browser':
      await openDappBrowser(context);
      return;
    case 'dapp-connect':
      await connectDappBrowser(context, accounts);
      return;
    case 'lending-markets':
      await openLendingMarkets(context);
      return;
    case 'perps-entry':
      await openPerps(context);
      return;
    case 'sync-extension-password':
      await openSyncExtensionPassword(context);
      return;
    case 'transaction-history':
      await openTransactionHistory(context);
      return;
    default:
      throw new Error(
        `Unsupported focused scenario: ${context.command.scenario}`,
      );
  }
}
