import { CHAINS_ENUM } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import { RootNames } from '@/constant/layout';
import * as apisDapp from '@/core/apis/dapp';
import { sendRequest } from '@/core/apis/sendRequest';
import {
  getConnectedDappSnapshot,
  hasDappPermissionSnapshot,
} from '@/core/serviceApi/dapp';
import {
  getNotificationApprovalCountSnapshot,
  getNotificationWindowIdSnapshot,
  notificationServiceApi,
} from '@/core/serviceApi/notification';
import { browserApis } from '@/hooks/browser/useBrowser';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';
import {
  delay,
  ensureScenarioWalletUnlocked,
  getScenarioAccounts,
  pushNestedScreen,
} from './utils';

const REGRESSION_DAPP_INFO = {
  description: 'Rabby regression Dapp approval tester',
  id: 'https://tester.rabby.io',
  logo_url:
    'https://static.debank.com/image/project/logo_url/galxe/90baa6ae2cb97b4791f02fe66abec4b2.png',
  name: 'Rabby Regression Dapp',
  tags: [],
  user_range: 'Regression',
  chain_ids: [CHAINS_ENUM.ETH, CHAINS_ENUM.POLYGON],
};

const REGRESSION_DAPP_SESSION = {
  origin: REGRESSION_DAPP_INFO.id,
  name: REGRESSION_DAPP_INFO.name,
  icon: REGRESSION_DAPP_INFO.logo_url,
  $mobileCtx: {
    isFromMobileInnerDapp: true,
  },
};

async function prepareFocusedScenario(
  context: RegressionScenarioExecutionContext,
) {
  await context.waitForNavigation();
  await ensureScenarioWalletUnlocked();
  return getScenarioAccounts();
}

type ScenarioAccount = Awaited<ReturnType<typeof getScenarioAccounts>>[number];
type DappApprovalScenario =
  | 'dapp-sign-tx'
  | 'dapp-sign-text'
  | 'dapp-sign-typed-data'
  | 'dapp-cancel-signing';
type DappApprovalComponent = 'SignTx' | 'SignText' | 'SignTypedData';

function redactAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSelfOwnedAccount(accounts: readonly ScenarioAccount[]) {
  return accounts.find(
    item =>
      item.type !== KEYRING_TYPE.WatchAddressKeyring &&
      item.type !== KEYRING_TYPE.GnosisKeyring,
  );
}

function resolveDappTargetChain(rawChain?: string) {
  const normalized = (rawChain || 'polygon').trim().toLowerCase();
  if (normalized === 'polygon' || normalized === 'matic') {
    return findChain({ enum: CHAINS_ENUM.POLYGON });
  }
  return (
    findChain({ enum: normalized.toUpperCase() }) ||
    findChain({ serverId: normalized }) ||
    findChain({ hex: normalized.startsWith('0x') ? normalized : null })
  );
}

async function ensureRegressionDappConnected(account: ScenarioAccount) {
  await apisDapp.connect({
    origin: REGRESSION_DAPP_INFO.id,
    chainId: CHAINS_ENUM.ETH,
    session: REGRESSION_DAPP_SESSION,
    info: REGRESSION_DAPP_INFO,
    currentAccount: account,
  });
}

async function waitForDappApproval({
  context,
  expectedComponent,
  method,
  timeoutMs = 20_000,
}: {
  context: RegressionScenarioExecutionContext;
  expectedComponent: DappApprovalComponent;
  method: string;
  timeoutMs?: number;
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const approval = await notificationServiceApi.getApproval();
    const windowId = getNotificationWindowIdSnapshot();
    const component = approval?.data?.approvalComponent;
    const approvalMethod = approval?.data?.params?.method;
    const origin = approval?.data?.origin;

    if (component === expectedComponent && windowId) {
      context.report('assertion', {
        assertion: 'dapp-approval-opened',
        passed: true,
        expectedComponent,
        component,
        method,
        approvalMethod,
        origin,
        approvalCount: getNotificationApprovalCountSnapshot(),
        hasNotificationWindow: true,
        elapsedMs: Date.now() - startedAt,
      });
      return approval;
    }

    await delay(100);
  }

  const approval = await notificationServiceApi.getApproval();
  context.report('assertion', {
    assertion: 'dapp-approval-opened',
    passed: false,
    expectedComponent,
    component: approval?.data?.approvalComponent || null,
    method,
    approvalMethod: approval?.data?.params?.method || null,
    approvalCount: getNotificationApprovalCountSnapshot(),
    hasNotificationWindow: !!getNotificationWindowIdSnapshot(),
  });
  throw new Error(
    `Timed out waiting for ${expectedComponent} approval from ${method}`,
  );
}

async function waitForApprovalCleared({
  context,
  assertion,
  timeoutMs = 10_000,
}: {
  context: RegressionScenarioExecutionContext;
  assertion: string;
  timeoutMs?: number;
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const approval = await notificationServiceApi.getApproval();
    if (!approval && !getNotificationWindowIdSnapshot()) {
      context.report('assertion', {
        assertion,
        passed: true,
        approvalCount: getNotificationApprovalCountSnapshot(),
        hasNotificationWindow: false,
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }
    await delay(100);
  }

  const approval = await notificationServiceApi.getApproval();
  context.report('assertion', {
    assertion,
    passed: false,
    component: approval?.data?.approvalComponent || null,
    approvalCount: getNotificationApprovalCountSnapshot(),
    hasNotificationWindow: !!getNotificationWindowIdSnapshot(),
  });
  throw new Error('Timed out waiting for Dapp approval to clear');
}

function buildDappApprovalRequest({
  scenario,
  account,
}: {
  scenario: DappApprovalScenario;
  account: ScenarioAccount;
}) {
  switch (scenario) {
    case 'dapp-sign-tx': {
      const chain = findChain({ enum: CHAINS_ENUM.ETH });
      return {
        expectedComponent: 'SignTx' as const,
        method: 'eth_sendTransaction',
        params: [
          {
            from: account.address,
            to: account.address,
            value: '0x0',
            chainId: chain?.id || 1,
          },
        ],
      };
    }
    case 'dapp-sign-text':
    case 'dapp-cancel-signing':
      return {
        expectedComponent: 'SignText' as const,
        method: 'personal_sign',
        params: [
          '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
          account.address,
          'Example password',
        ],
      };
    case 'dapp-sign-typed-data':
      return {
        expectedComponent: 'SignTypedData' as const,
        method: 'eth_signTypedData_v4',
        params: [
          account.address,
          JSON.stringify({
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
              ],
              RegressionMessage: [
                { name: 'message', type: 'string' },
                { name: 'count', type: 'uint256' },
              ],
            },
            primaryType: 'RegressionMessage',
            domain: {
              name: 'Rabby Regression',
              version: '1',
              chainId: 1,
            },
            message: {
              message: 'Rabby regression typed data smoke test',
              count: 1,
            },
          }),
        ],
      };
  }
}

async function openDappApproval(
  context: RegressionScenarioExecutionContext,
  accounts: readonly ScenarioAccount[],
) {
  const account = getSelfOwnedAccount(accounts);
  if (!account) {
    throw new Error('Dapp approval scenario requires a self-owned account');
  }

  await ensureRegressionDappConnected(account);
  const request = buildDappApprovalRequest({
    scenario: context.command.scenario as DappApprovalScenario,
    account,
  });

  context.report('assertion', {
    assertion: 'dapp-approval-request-ready',
    passed: true,
    scenario: context.command.scenario,
    method: request.method,
    account: redactAddress(account.address),
    origin: REGRESSION_DAPP_INFO.id,
  });

  const pendingRequest = sendRequest({
    data: {
      method: request.method,
      params: request.params,
    },
    session: REGRESSION_DAPP_SESSION,
    account,
    requestContext: {
      origin: REGRESSION_DAPP_INFO.id,
      source: 'dapp',
      chainId: findChain({ enum: CHAINS_ENUM.ETH })?.id || 1,
      accountAddress: account.address,
    },
  }).catch(() => undefined);

  try {
    await waitForDappApproval({
      context,
      expectedComponent: request.expectedComponent,
      method: request.method,
    });
  } finally {
    await notificationServiceApi.rejectApproval(
      'Regression scenario observed approval',
    );
    await pendingRequest;
    await waitForApprovalCleared({
      context,
      assertion:
        context.command.scenario === 'dapp-cancel-signing'
          ? 'dapp-signing-cancelled'
          : 'dapp-approval-cleaned-up',
    });
  }
}

async function switchDappChain(
  context: RegressionScenarioExecutionContext,
  accounts: readonly ScenarioAccount[],
) {
  const account = getSelfOwnedAccount(accounts);
  if (!account) {
    throw new Error('Dapp chain switch scenario requires a self-owned account');
  }

  const targetChain = resolveDappTargetChain(context.command.params.chain);
  if (!targetChain) {
    throw new Error(
      `Unsupported Dapp chain switch target: ${
        context.command.params.chain || 'polygon'
      }`,
    );
  }

  await ensureRegressionDappConnected(account);

  const before = getConnectedDappSnapshot(REGRESSION_DAPP_INFO.id);
  context.report('assertion', {
    assertion: 'dapp-switch-chain-request-ready',
    passed: true,
    origin: REGRESSION_DAPP_INFO.id,
    fromChain: before?.chainId || null,
    targetChain: targetChain.enum,
    targetChainHex: targetChain.hex,
  });

  await sendRequest({
    data: {
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChain.hex }],
    },
    session: REGRESSION_DAPP_SESSION,
    account,
    requestContext: {
      origin: REGRESSION_DAPP_INFO.id,
      source: 'dapp',
      chainId: findChain({ enum: CHAINS_ENUM.ETH })?.id || 1,
      accountAddress: account.address,
    },
  });

  const connected = getConnectedDappSnapshot(REGRESSION_DAPP_INFO.id);
  const passed = connected?.chainId === targetChain.enum;
  context.report('assertion', {
    assertion: 'dapp-chain-switched',
    passed,
    origin: REGRESSION_DAPP_INFO.id,
    targetChain: targetChain.enum,
    connectedChain: connected?.chainId || null,
  });

  if (!passed) {
    throw new Error(
      'Dapp chain did not converge after wallet_switchEthereumChain',
    );
  }
}

async function disconnectRegressionDapp(
  context: RegressionScenarioExecutionContext,
  accounts: readonly ScenarioAccount[],
) {
  const account = getSelfOwnedAccount(accounts);
  if (!account) {
    throw new Error('Dapp disconnect scenario requires a self-owned account');
  }

  await ensureRegressionDappConnected(account);
  const before = getConnectedDappSnapshot(REGRESSION_DAPP_INFO.id);
  context.report('assertion', {
    assertion: 'dapp-disconnect-precondition',
    passed: !!before?.isConnected,
    origin: REGRESSION_DAPP_INFO.id,
    account: before?.currentAccount?.address
      ? redactAddress(before.currentAccount.address)
      : null,
  });

  await sendRequest({
    data: {
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    },
    session: REGRESSION_DAPP_SESSION,
    account,
    requestContext: {
      origin: REGRESSION_DAPP_INFO.id,
      source: 'dapp',
      chainId: findChain({ enum: CHAINS_ENUM.ETH })?.id || 1,
      accountAddress: account.address,
    },
  });

  const connected = getConnectedDappSnapshot(REGRESSION_DAPP_INFO.id);
  const hasPermission = hasDappPermissionSnapshot(REGRESSION_DAPP_INFO.id);
  const passed = !connected && !hasPermission;
  context.report('assertion', {
    assertion: 'dapp-disconnected',
    passed,
    origin: REGRESSION_DAPP_INFO.id,
    hasPermission,
    connected: !!connected,
  });

  if (!passed) {
    throw new Error(
      'Dapp permission did not clear after wallet_revokePermissions',
    );
  }
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
  const requestedUrl = context.command.params.url || 'https://tester.rabby.io';
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

async function openGasAccount(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackTransaction, RootNames.GasAccount, {});
  await context.waitForRoute(RootNames.GasAccount);
  context.report('assertion', {
    assertion: 'gas-account-opened',
    passed: true,
  });
}

async function openMarket(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackHomeNonTab, RootNames.Market, {});
  await context.waitForRoute(RootNames.Market);
  context.report('assertion', {
    assertion: 'market-opened',
    passed: true,
  });
}

async function openApprovalsEntry(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackAddress, RootNames.ApprovalAddressList, {});
  await context.waitForRoute(RootNames.ApprovalAddressList);
  context.report('assertion', {
    assertion: 'approvals-address-list-opened',
    passed: true,
  });
}

async function openRabbyPoints(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackAddress, RootNames.Points, {});
  await context.waitForRoute(RootNames.Points);
  context.report('assertion', {
    assertion: 'rabby-points-opened',
    passed: true,
  });
}

async function openConvertDust(context: RegressionScenarioExecutionContext) {
  pushNestedScreen(RootNames.StackTransaction, RootNames.ConvertDust, {});
  await context.waitForRoute(RootNames.ConvertDust);
  context.report('assertion', {
    assertion: 'convert-dust-opened',
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
    case 'dapp-switch-chain':
      await switchDappChain(context, accounts);
      return;
    case 'dapp-disconnect':
      await disconnectRegressionDapp(context, accounts);
      return;
    case 'dapp-sign-tx':
    case 'dapp-sign-text':
    case 'dapp-sign-typed-data':
    case 'dapp-cancel-signing':
      await openDappApproval(context, accounts);
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
    case 'gas-account-entry':
      await openGasAccount(context);
      return;
    case 'market-entry':
      await openMarket(context);
      return;
    case 'approvals-entry':
      await openApprovalsEntry(context);
      return;
    case 'rabby-points-entry':
      await openRabbyPoints(context);
      return;
    case 'convert-dust-entry':
      await openConvertDust(context);
      return;
    default:
      throw new Error(
        `Unsupported focused scenario: ${context.command.scenario}`,
      );
  }
}
