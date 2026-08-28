import { CHAINS_ENUM } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import { RootNames } from '@/constant/layout';
import * as apisDapp from '@/core/apis/dapp';
import { sendRequest } from '@/core/apis/sendRequest';
import type { HermesProfilerSessionResult } from '@/core/utils/hermesStartupProfiler';
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
import { runRegressionScenarioComponentAction } from '../componentActions.nonprod';
import {
  delay,
  ensureScenarioWalletUnlocked,
  getScenarioAccounts,
  parseScenarioBoolean,
  pushNestedScreen,
  startScenarioPerformanceWindow,
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

async function startMainRuntimeProfile(
  context: RegressionScenarioExecutionContext,
  {
    label,
    observeMs,
    filePrefix,
    enabledByDefault = false,
  }: {
    label: string;
    observeMs: number;
    filePrefix: string;
    enabledByDefault?: boolean;
  },
) {
  const profileMode = context.command.params.hermesProfile;
  const shouldProfile =
    profileMode?.toLowerCase() === 'main' ||
    parseScenarioBoolean(profileMode, enabledByDefault);
  if (!shouldProfile) {
    return null;
  }

  const profiler = await import('@/core/utils/hermesStartupProfiler');
  const profileWaitMs = Math.min(
    Math.max(Number(context.command.params.profileWaitMs || 12_000), 0),
    15_000,
  );
  const waitStartedAt = Date.now();
  while (
    profiler.isHermesProfilerSessionActive() &&
    Date.now() - waitStartedAt < profileWaitMs
  ) {
    await delay(100);
  }
  if (profiler.isHermesProfilerSessionActive()) {
    throw new Error('Hermes profiler is still occupied by another session');
  }

  const computationThread = await import('@/perfs/thread');
  const workerWasRunning = computationThread.workerThread.isRunning;
  const reasonLabel = label.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  if (workerWasRunning) {
    context.report('perf-mark', {
      label,
      mark: 'main-runtime-profile-worker-stop-start',
    });
    await computationThread.workerThread.terminate();
    await delay(250);
    context.report('perf-mark', {
      label,
      mark: 'main-runtime-profile-worker-stopped',
    });
  }

  const session = profiler.startHermesProfilerSession({
    label: `${label}-${context.command.runId}`,
    expectedDurationMs: Math.min(Math.max(observeMs, 0), 10_000) + 4000,
    filePrefix: `${filePrefix}-${context.command.runId}`,
    includePlatformProfile: parseScenarioBoolean(
      context.command.params.platformProfile,
      true,
    ),
  });

  if (!session) {
    if (workerWasRunning) {
      computationThread.requestComputationThreadStart(
        `${reasonLabel}_profile_start_failed`,
      );
    }
    throw new Error(`Unable to start ${label} Hermes profile`);
  }

  context.report('perf-mark', {
    label,
    mark: 'main-runtime-profile-started',
    workerWasRunning,
  });

  return {
    session,
    restoreWorker() {
      if (workerWasRunning) {
        computationThread.requestComputationThreadStart(
          `${reasonLabel}_profile_complete`,
        );
      }
    },
  };
}

async function openSendEntry(context: RegressionScenarioExecutionContext) {
  const observeMs = Math.min(
    Math.max(Number(context.command.params.observeMs || 4000), 500),
    8000,
  );
  const profileCapture = await startMainRuntimeProfile(context, {
    label: 'send-entry',
    observeMs,
    filePrefix: 'rabby-send-entry-main',
    enabledByDefault: true,
  });
  const perfWindow = startScenarioPerformanceWindow(context, {
    label: 'send-entry',
    reportEachGap: true,
  });
  let profileResult: HermesProfilerSessionResult | undefined;

  try {
    perfWindow.mark('navigation-dispatch-start');
    pushNestedScreen(RootNames.StackTransaction, RootNames.Send, {});
    perfWindow.mark('navigation-dispatch-end');
    await context.waitForRoute(RootNames.Send);
    perfWindow.mark('route-ready');
    context.report('assertion', {
      assertion: 'send-entry-route-ready',
      passed: true,
    });
    await delay(observeMs);
    perfWindow.mark('post-route-observed', { observeMs });
  } finally {
    perfWindow.stop('send-entry-scenario-complete');
    if (profileCapture) {
      profileResult = await profileCapture.session.stop();
      profileCapture.restoreWorker();
      context.report('perf-mark', {
        label: 'send-entry',
        mark: 'main-runtime-profile-saved',
        durationMs: profileResult.durationMs,
        profilePath: profileResult.profilePath || '',
        androidProfilePath: profileResult.androidProfilePath || '',
        error: profileResult.error || '',
      });
    }
  }

  if (profileCapture && !profileResult?.profilePath) {
    throw new Error(
      profileResult?.error || 'Send entry Hermes profile was not saved',
    );
  }
}

async function openSendTokenSelector(
  context: RegressionScenarioExecutionContext,
) {
  const observeMs = Math.min(
    Math.max(Number(context.command.params.observeMs || 2500), 500),
    5000,
  );
  const settleMs = Math.min(
    Math.max(Number(context.command.params.settleMs || 800), 300),
    2000,
  );
  const initialDelayMs = Math.min(
    Math.max(Number(context.command.params.initialDelayMs || 600), 0),
    15_000,
  );
  const openCount = Math.min(
    Math.max(Math.round(Number(context.command.params.openCount || 2)), 1),
    100,
  );
  const reportEvery = Math.min(
    Math.max(Math.round(Number(context.command.params.reportEvery || 10)), 1),
    100,
  );
  const warmupOpenCount = Math.min(
    Math.max(
      Math.round(Number(context.command.params.warmupOpenCount || 0)),
      0,
    ),
    1,
  );
  const warmupObserveMs = Math.min(
    Math.max(Number(context.command.params.warmupObserveMs || observeMs), 500),
    5000,
  );

  pushNestedScreen(RootNames.StackTransaction, RootNames.Send, {});
  await context.waitForRoute(RootNames.Send);
  context.report('assertion', {
    assertion: 'send-token-selector-screen-opened',
    passed: true,
  });
  await delay(initialDelayMs);

  for (let index = 0; index < warmupOpenCount; index += 1) {
    context.report('perf-mark', {
      label: 'send-token-selector-entry',
      mark: 'selector-warmup-open-start',
      openSequence: index + 1,
    });
    await runRegressionScenarioComponentAction(
      context.command.runId,
      'send-token-selector.open',
      15_000,
    );
    await delay(warmupObserveMs);
    await runRegressionScenarioComponentAction(
      context.command.runId,
      'send-token-selector.close',
      15_000,
    );
    await delay(settleMs);
    context.report('perf-mark', {
      label: 'send-token-selector-entry',
      mark: 'selector-warmup-complete',
      openSequence: index + 1,
    });
  }

  const profileDurationMs =
    observeMs * openCount + settleMs * Math.max(0, openCount - 1) + 1000;
  const profileCapture = await startMainRuntimeProfile(context, {
    label: 'send-token-selector-entry',
    observeMs: profileDurationMs,
    filePrefix: 'rabby-send-token-selector-main',
    enabledByDefault: true,
  });
  const perfWindow = startScenarioPerformanceWindow(context, {
    label: 'send-token-selector-entry',
    reportEachGap: true,
  });
  let profileResult: HermesProfilerSessionResult | undefined;

  try {
    for (let index = 0; index < openCount; index += 1) {
      const openSequence = index + 1;
      perfWindow.mark('selector-open-start', { openSequence });
      await runRegressionScenarioComponentAction(
        context.command.runId,
        'send-token-selector.open',
        15_000,
      );
      perfWindow.mark('selector-open-dispatched', { openSequence });
      await delay(observeMs);

      perfWindow.mark('selector-close-start', { openSequence });
      await runRegressionScenarioComponentAction(
        context.command.runId,
        'send-token-selector.close',
        15_000,
      );
      perfWindow.mark('selector-close-dispatched', { openSequence });

      if (index + 1 < openCount) {
        await delay(settleMs);
      }

      if (openSequence % reportEvery === 0 || openSequence === openCount) {
        context.report('perf-mark', {
          label: 'send-token-selector-entry',
          mark: 'selector-cycle-checkpoint',
          openSequence,
          openCount,
        });
      }
    }
  } finally {
    perfWindow.stop('send-token-selector-scenario-complete');
    if (profileCapture) {
      profileResult = await profileCapture.session.stop();
      profileCapture.restoreWorker();
      context.report('perf-mark', {
        label: 'send-token-selector-entry',
        mark: 'main-runtime-profile-saved',
        durationMs: profileResult.durationMs,
        profilePath: profileResult.profilePath || '',
        androidProfilePath: profileResult.androidProfilePath || '',
        error: profileResult.error || '',
      });
    }
  }

  if (profileCapture && !profileResult?.profilePath) {
    throw new Error(
      profileResult?.error ||
        'Send token selector Hermes profile was not saved',
    );
  }

  context.report('assertion', {
    assertion: 'send-token-selector-profile-ready',
    passed: true,
    openCount,
    warmupOpenCount,
    observeMs,
    reportEvery,
    profilePath: profileResult?.profilePath || '',
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
    case 'send-entry-profile':
      await openSendEntry(context);
      return;
    case 'send-token-selector-entry':
      await openSendTokenSelector(context);
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
