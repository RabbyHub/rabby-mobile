import { StackActions } from '@react-navigation/native';
import { CHAINS_ENUM } from '@debank/common';
import BigNumber from 'bignumber.js';

import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import {
  getLatestStoreActivityScopeDiagnostics,
  getStoreActivityDiagnosticsSnapshot,
} from '@/core/state/storeActivityDiagnostics';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { getSingleAddressChainProjectionDiagnosticsSnapshot } from '@/screens/Home/singleAddressChainDiagnostics';
import { getAssetDataLoadDiagnosticsSnapshot } from '@/core/utils/assetDataLoadDiagnostics';
import {
  apiSendToken,
  requestSendTokenFormPatch,
} from '@/screens/Send/hooks/useSendToken';
import { StablecoinMapAggregatedByChain } from '@/constant/swap';
import {
  getFallbackAccountSnapshot,
  preferenceServiceApi,
} from '@/core/serviceApi/preference';
import tokenStore from '@/store/tokens';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { findChain, findChainByEnum, makeTokenFromChain } from '@/utils/chain';
import { navigationRef } from '@/utils/navigation';
import { addressUtils } from '@rabby-wallet/base-utils';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';
import { runRegressionScenarioComponentAction } from '../componentActions.nonprod';
import {
  compactRegressionScenarioPerformanceSummary,
  createRegressionScenarioPerformanceProbe,
} from '../performance.nonprod';
import {
  delay,
  ensureScenarioWalletUnlocked,
  getScenarioAccounts,
  parseScenarioBoolean,
  pushNestedScreen,
  resetToHome,
  waitForScenarioAssertion,
} from './utils';

const DEFAULT_FUNDED_TEST_CHAIN = CHAINS_ENUM.POLYGON;
const DEFAULT_BRIDGE_TO_CHAIN = CHAINS_ENUM.ARBITRUM;
const DEFAULT_TARGET_USD = '0.1';
const DEFAULT_MAX_TOTAL_USD = '1';
const MAX_SWAP_BRIDGE_PRESSURE_CYCLES = 20;
const MAX_SELECTOR_PRESSURE_CYCLES = 5;
const HOME_TAB_READY_ASSERTIONS: Record<number, string | undefined> = {
  1: 'home-assets-token-ready',
  2: 'home-assets-defi-ready',
  3: 'home-assets-nft-ready',
};
const HOME_TAB_ACTIVITY_SCOPE_LABELS = [
  'home-multi-assets-overview',
  'home-multi-assets-token',
  'home-multi-assets-defi',
  'home-multi-assets-nft',
] as const;
const HOME_TAB_ACTIVITY_VERIFICATION_TABS = [0, 1, 2, 3, 0] as const;
const SINGLE_ADDRESS_SCREEN_ACTIVITY_SCOPE_LABELS = [
  'single-address',
  'single-address-header',
] as const;
const SINGLE_ADDRESS_TAB_ACTIVITY = [
  {
    name: 'tokens',
    action: 'single-address.activate-tokens',
    scopeLabel: 'single-address-tokens',
  },
  {
    name: 'defi',
    action: 'single-address.activate-defi',
    scopeLabel: 'single-address-defi',
  },
  {
    name: 'nft',
    action: 'single-address.activate-nft',
    scopeLabel: 'single-address-nft',
  },
] as const;
const SINGLE_ADDRESS_EXPAND_ACTIONS = {
  tokens: {
    collapseAction: 'single-address.collapse-tokens',
    action: 'single-address.expand-tokens',
    readyAssertion: 'single-address-tokens-ready',
    assertion: 'single-address-tokens-expanded',
  },
  nft: {
    collapseAction: 'single-address.collapse-nfts',
    action: 'single-address.expand-nfts',
    readyAssertion: 'single-address-nfts-ready',
    assertion: 'single-address-nfts-expanded',
  },
} as const;
const SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS = [
  ...SINGLE_ADDRESS_SCREEN_ACTIVITY_SCOPE_LABELS,
  ...SINGLE_ADDRESS_TAB_ACTIVITY.map(tab => tab.scopeLabel),
] as const;

function formatSafeAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readUsdParam(value: string | undefined, fallback: string) {
  const parsed = new BigNumber(value || fallback);
  if (!parsed.isFinite() || !parsed.gt(0)) {
    throw new Error(`Invalid USD amount: ${value}`);
  }
  return parsed;
}

function readTargetUsd(context: RegressionScenarioExecutionContext) {
  const targetUsd = readUsdParam(
    context.command.params.targetUsd,
    DEFAULT_TARGET_USD,
  );
  const maxTotalUsd = readUsdParam(
    context.command.params.maxTotalUsd,
    DEFAULT_MAX_TOTAL_USD,
  );
  if (targetUsd.gt(maxTotalUsd)) {
    throw new Error('targetUsd must not exceed maxTotalUsd');
  }
  return { targetUsd, maxTotalUsd };
}

function readBoundedScenarioInteger({
  context,
  key,
  fallback,
  min,
  max,
}: {
  context: RegressionScenarioExecutionContext;
  key: string;
  fallback: number;
  min: number;
  max: number;
}) {
  const raw = context.command.params[key];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

async function activateSwapBridgeTabForPressure(
  context: RegressionScenarioExecutionContext,
  tab: 'swap' | 'bridge',
  probe: ReturnType<typeof createRegressionScenarioPerformanceProbe>,
) {
  const actionStartedAt = Date.now();
  const actionTiming = await runRegressionScenarioComponentAction(
    context.command.runId,
    `swap-bridge.activate-${tab}`,
  );
  probe.recordAction(`activate.${tab}`, actionTiming);
  const assertionStartedAt = Date.now();
  await waitForScenarioAssertion(
    context,
    `swap-bridge-${tab}-active`,
    10_000,
    actionStartedAt,
  );
  probe.recordDuration(
    `activate.${tab}.assertion`,
    Date.now() - assertionStartedAt,
  );
}

async function exerciseTokenSelectorForPressure(
  context: RegressionScenarioExecutionContext,
  selector: 'swapFrom' | 'swapTo' | 'bridgeFrom' | 'bridgeTo',
  settleMs: number,
  probe: ReturnType<typeof createRegressionScenarioPerformanceProbe>,
) {
  const actionPrefix = `token-selector.${selector}`;
  const openTiming = await runRegressionScenarioComponentAction(
    context.command.runId,
    `${actionPrefix}.open`,
  );
  probe.recordAction(`${selector}.open`, openTiming);
  await delay(settleMs);
  const closeTiming = await runRegressionScenarioComponentAction(
    context.command.runId,
    `${actionPrefix}.close`,
  );
  probe.recordAction(`${selector}.close`, closeTiming);
  await delay(settleMs);
}

async function runSwapBridgePressure(
  context: RegressionScenarioExecutionContext,
  activeTab: 'swap' | 'bridge',
) {
  const cycles = readBoundedScenarioInteger({
    context,
    key: 'pressureCycles',
    fallback: 0,
    min: 0,
    max: MAX_SWAP_BRIDGE_PRESSURE_CYCLES,
  });
  if (!cycles) {
    return;
  }

  const selectorCycles = readBoundedScenarioInteger({
    context,
    key: 'selectorCycles',
    fallback: 1,
    min: 0,
    max: MAX_SELECTOR_PRESSURE_CYCLES,
  });
  const settleMs = readBoundedScenarioInteger({
    context,
    key: 'pressureSettleMs',
    fallback: 500,
    min: 100,
    max: 2_000,
  });
  const startedAt = Date.now();
  const probe = createRegressionScenarioPerformanceProbe();
  const pressureTabs =
    activeTab === 'swap'
      ? (['bridge', 'swap'] as const)
      : (['swap', 'bridge'] as const);

  try {
    for (let cycle = 1; cycle <= cycles; cycle += 1) {
      const cycleStartedAt = Date.now();
      for (const tab of pressureTabs) {
        await activateSwapBridgeTabForPressure(context, tab, probe);
        for (
          let selectorCycle = 0;
          selectorCycle < selectorCycles;
          selectorCycle += 1
        ) {
          await exerciseTokenSelectorForPressure(
            context,
            tab === 'swap' ? 'swapFrom' : 'bridgeFrom',
            settleMs,
            probe,
          );
          await exerciseTokenSelectorForPressure(
            context,
            tab === 'swap' ? 'swapTo' : 'bridgeTo',
            settleMs,
            probe,
          );
        }
      }
      context.report('perf-mark', {
        mark: 'swap-bridge-pressure-cycle',
        cycle,
        cycleDurationMs: Date.now() - cycleStartedAt,
        elapsedMs: Date.now() - startedAt,
      });
      probe.recordDuration('pressure.cycle', Date.now() - cycleStartedAt);
    }
  } finally {
    context.report('perf-mark', {
      mark: 'swap-bridge-pressure-summary',
      fixedSettleMs: cycles * 2 * selectorCycles * 2 * 2 * settleMs,
      ...probe.stop(),
    });
  }

  context.report('assertion', {
    assertion: 'swap-bridge-pressure-complete',
    passed: true,
    cycles,
    selectorCycles,
    settleMs,
    elapsedMs: Date.now() - startedAt,
  });
}

function readScenarioChain(context: RegressionScenarioExecutionContext) {
  const raw = (context.command.params.chain || 'polygon').trim();
  const normalized = raw.toLowerCase();
  if (['polygon', 'matic'].includes(normalized)) {
    return DEFAULT_FUNDED_TEST_CHAIN;
  }

  const byEnum = findChainByEnum(raw.toUpperCase() as CHAINS_ENUM);
  if (byEnum) {
    return byEnum.enum;
  }

  const byServerId = findChain({ serverId: raw });
  if (byServerId) {
    return byServerId.enum;
  }

  throw new Error(`Unsupported scenario chain: ${raw}`);
}

function selectScenarioAccount(
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
  suffix?: string,
) {
  const normalizedSuffix = suffix?.trim().toLowerCase();
  if (!normalizedSuffix) {
    return accounts[0]!;
  }
  const account = accounts.find(item =>
    item.address.toLowerCase().endsWith(normalizedSuffix),
  );
  if (!account) {
    throw new Error(`No scenario account ends with ${normalizedSuffix}`);
  }
  return account;
}

function readTransferToAddress(context: RegressionScenarioExecutionContext) {
  const address = context.command.params.toAddress?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('send-transfer requires a valid toAddress');
  }
  return address;
}

function tokenAmountFromRawHex(
  rawAmountHex: string | undefined,
  decimals = 18,
) {
  const normalized = (rawAmountHex || '0').replace(/^0x/i, '') || '0';
  return new BigNumber(normalized, 16).div(new BigNumber(10).pow(decimals));
}

async function resolveNativeTokenPlan({
  account,
  chainEnum,
  maxTotalUsd,
  targetUsd,
}: {
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number];
  chainEnum: CHAINS_ENUM;
  targetUsd: BigNumber;
  maxTotalUsd: BigNumber;
}) {
  const chain = findChainByEnum(chainEnum);
  if (!chain) {
    throw new Error(`Unable to resolve chain: ${chainEnum}`);
  }

  const nativeToken = makeTokenFromChain(chain);
  const realtimeToken = await openapi.getToken(
    account.address,
    chain.serverId,
    nativeToken.id,
  );
  const token = {
    ...nativeToken,
    ...realtimeToken,
  };
  const price = new BigNumber(token.price || 0);
  if (!price.gt(0)) {
    throw new Error(`Unable to price ${chain.serverId} native token`);
  }

  const amount = targetUsd
    .div(price)
    .decimalPlaces(Math.min(token.decimals || 18, 6), BigNumber.ROUND_UP);
  const actualUsd = amount.times(price);
  if (!amount.gt(0) || actualUsd.gt(maxTotalUsd)) {
    throw new Error('Calculated funded test amount is outside safety limits');
  }

  const balance = tokenAmountFromRawHex(
    token.raw_amount_hex_str,
    token.decimals,
  );
  if (!balance.gt(amount)) {
    throw new Error(
      `Insufficient ${chain.serverId} native token balance for funded dry-run`,
    );
  }

  return {
    chain,
    token,
    amount: amount.toString(10),
    actualUsd: actualUsd.toString(10),
    balance: balance.toString(10),
  };
}

async function resolveStableTokenPlan({
  account,
  chainEnum,
  maxTotalUsd,
  stable = 'usdc',
  targetUsd,
}: {
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number];
  chainEnum: CHAINS_ENUM;
  targetUsd: BigNumber;
  maxTotalUsd: BigNumber;
  stable?: keyof NonNullable<
    (typeof StablecoinMapAggregatedByChain)[CHAINS_ENUM]
  >;
}) {
  const chain = findChainByEnum(chainEnum);
  if (!chain) {
    throw new Error(`Unable to resolve chain: ${chainEnum}`);
  }

  const tokenId = StablecoinMapAggregatedByChain[chainEnum]?.[stable];
  if (!tokenId) {
    throw new Error(`No ${stable} token configured for ${chain.serverId}`);
  }

  const token = await openapi.getToken(
    account.address,
    chain.serverId,
    tokenId,
  );
  const price = new BigNumber(token.price || 0);
  if (!price.gt(0)) {
    throw new Error(`Unable to price ${chain.serverId} ${stable}`);
  }

  const amount = targetUsd
    .div(price)
    .decimalPlaces(Math.min(token.decimals || 6, 6), BigNumber.ROUND_UP);
  const actualUsd = amount.times(price);
  if (!amount.gt(0) || actualUsd.gt(maxTotalUsd)) {
    throw new Error('Calculated funded test amount is outside safety limits');
  }

  const balance = tokenAmountFromRawHex(
    token.raw_amount_hex_str,
    token.decimals,
  );
  if (!balance.gt(amount)) {
    throw new Error(
      `Insufficient ${chain.serverId} ${stable} balance for funded dry-run`,
    );
  }

  return {
    chain,
    token,
    amount: amount.toString(10),
    actualUsd: actualUsd.toString(10),
    balance: balance.toString(10),
  };
}

function readBridgeToChain(context: RegressionScenarioExecutionContext) {
  const raw = (context.command.params.toChain || 'arbitrum').trim();
  const normalized = raw.toLowerCase();
  if (['arbitrum', 'arb'].includes(normalized)) {
    return DEFAULT_BRIDGE_TO_CHAIN;
  }

  const byEnum = findChainByEnum(raw.toUpperCase() as CHAINS_ENUM);
  if (byEnum) {
    return byEnum.enum;
  }

  const byServerId = findChain({ serverId: raw });
  if (byServerId) {
    return byServerId.enum;
  }

  throw new Error(`Unsupported bridge target chain: ${raw}`);
}

async function prepareScenario(context: RegressionScenarioExecutionContext) {
  await context.waitForNavigation();
  await ensureScenarioWalletUnlocked();
  const accounts = await getScenarioAccounts();
  return {
    accounts,
    account: accounts[0]!,
  };
}

async function waitForHomeTabIndex(tabIndex: number, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (
      apisHomeTabIndex.homeTabScrollerRef.current?.getCurrentIndex() ===
      tabIndex
    ) {
      return;
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for Home tab index: ${tabIndex}`);
}

function summarizeHomeTabActivityScopes() {
  const snapshot = getStoreActivityDiagnosticsSnapshot();
  const scopes = HOME_TAB_ACTIVITY_SCOPE_LABELS.map(
    getLatestStoreActivityScopeDiagnostics,
  );

  return {
    enabled: snapshot.enabled,
    scopes,
    report: scopes.map((scope, index) => ({
      label: HOME_TAB_ACTIVITY_SCOPE_LABELS[index],
      mounted: !!scope,
      active: scope?.active ?? false,
      consumerCount:
        scope?.stores.reduce((sum, store) => sum + store.consumerCount, 0) ?? 0,
      sourceSubscriptionCount:
        scope?.stores.filter(store => store.sourceSubscribed).length ?? 0,
      catchUpCount:
        scope?.stores.reduce((sum, store) => sum + store.catchUpCount, 0) ?? 0,
    })),
  };
}

async function assertHomeTabActivity(
  context: RegressionScenarioExecutionContext,
  tabIndex: (typeof HOME_TAB_ACTIVITY_VERIFICATION_TABS)[number],
) {
  const expectedActiveLabel = HOME_TAB_ACTIVITY_SCOPE_LABELS[tabIndex];
  const startedAt = Date.now();
  let latest = summarizeHomeTabActivityScopes();

  while (Date.now() - startedAt < 10_000) {
    latest = summarizeHomeTabActivityScopes();
    const allScopesMounted = latest.scopes.every(Boolean);
    const activityMatches = latest.scopes.every(scope => {
      if (!scope) {
        return false;
      }
      const shouldBeActive = scope.label === expectedActiveLabel;
      if (scope.active !== shouldBeActive) {
        return false;
      }
      if (!shouldBeActive) {
        return scope.stores.every(store => !store.sourceSubscribed);
      }

      return (
        scope.stores.some(store => store.sourceSubscribed) &&
        scope.stores.every(
          store => store.consumerCount === 0 || store.sourceSubscribed,
        )
      );
    });

    if (latest.enabled && allScopesMounted && activityMatches) {
      context.report('assertion', {
        assertion: 'home-tabs-store-activity',
        passed: true,
        tabIndex,
        expectedActiveLabel,
        scopes: latest.report,
      });
      return;
    }
    await delay(50);
  }

  context.report('assertion', {
    assertion: 'home-tabs-store-activity',
    passed: false,
    tabIndex,
    expectedActiveLabel,
    scopes: latest.report,
  });
  throw new Error(`Home asset activity did not converge for tab ${tabIndex}`);
}

async function openHomeAssets(context: RegressionScenarioExecutionContext) {
  resetToHome();
  await context.waitForRoute(RootNames.Home);

  const requestedTabs = (context.command.params.tabs || '0,1,2,3')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value >= 0 && value <= 3);
  for (const tabIndex of requestedTabs) {
    apisHomeTabIndex.setTabIndex(tabIndex, true);
    await waitForHomeTabIndex(tabIndex);
    context.report('assertion', {
      assertion: 'home-tab-selected',
      passed: navigationRef.getCurrentRoute()?.name === RootNames.Home,
      tabIndex,
      route: navigationRef.getCurrentRoute()?.name || null,
    });
    const readyAssertion = HOME_TAB_READY_ASSERTIONS[tabIndex];
    if (readyAssertion) {
      await waitForScenarioAssertion(context, readyAssertion, 45_000);
    } else {
      await delay(350);
    }
  }

  for (const tabIndex of HOME_TAB_ACTIVITY_VERIFICATION_TABS) {
    apisHomeTabIndex.setTabIndex(tabIndex, true);
    await waitForHomeTabIndex(tabIndex);
    await assertHomeTabActivity(context, tabIndex);
  }
}

async function switchCurrentAddress(
  context: RegressionScenarioExecutionContext,
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
) {
  resetToHome();
  await context.waitForRoute(RootNames.Home);

  if (accounts.length < 2) {
    context.report('assertion', {
      assertion: 'address-switch-skipped',
      passed: true,
      reason: 'at-least-two-accounts-required',
      accountCount: accounts.length,
    });
    return;
  }

  const current = getFallbackAccountSnapshot();
  const target =
    accounts.find(
      account =>
        !current ||
        !addressUtils.isSameAddress(account.address, current.address) ||
        account.type !== current.type ||
        account.brandName !== current.brandName,
    ) || accounts[1]!;

  await preferenceServiceApi.setCurrentAccount(target);
  await delay(100);

  const next = getFallbackAccountSnapshot();
  const passed =
    !!next &&
    addressUtils.isSameAddress(next.address, target.address) &&
    next.type === target.type &&
    next.brandName === target.brandName;

  context.report('assertion', {
    assertion: 'fallback-account-switched',
    passed,
    from: current
      ? `${current.address.slice(0, 6)}...${current.address.slice(-4)}`
      : null,
    to: `${target.address.slice(0, 6)}...${target.address.slice(-4)}`,
    current: next
      ? `${next.address.slice(0, 6)}...${next.address.slice(-4)}`
      : null,
  });

  if (!passed) {
    throw new Error('Fallback account did not switch to target account');
  }
}

function summarizeSingleAddressActivityScopes() {
  const snapshot = getStoreActivityDiagnosticsSnapshot();
  const scopes = SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS.map(
    getLatestStoreActivityScopeDiagnostics,
  );

  return {
    enabled: snapshot.enabled,
    scopes,
    report: scopes.map((scope, index) => ({
      label: SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS[index],
      mounted: !!scope,
      active: scope?.active ?? false,
      consumerCount:
        scope?.stores.reduce((sum, store) => sum + store.consumerCount, 0) ?? 0,
      sourceSubscriptionCount:
        scope?.stores.filter(store => store.sourceSubscribed).length ?? 0,
      sourceSubscribeCount:
        scope?.stores.reduce(
          (sum, store) => sum + store.sourceSubscribeCount,
          0,
        ) ?? 0,
      sourceNotificationCount:
        scope?.stores.reduce(
          (sum, store) => sum + store.sourceNotificationCount,
          0,
        ) ?? 0,
      publishedNotificationCount:
        scope?.stores.reduce(
          (sum, store) => sum + store.publishedNotificationCount,
          0,
        ) ?? 0,
      catchUpCount:
        scope?.stores.reduce((sum, store) => sum + store.catchUpCount, 0) ?? 0,
    })),
  };
}

type SingleAddressActivitySummary = ReturnType<
  typeof summarizeSingleAddressActivityScopes
>;

function diffSingleAddressStoreActivity(
  before: SingleAddressActivitySummary,
  after: SingleAddressActivitySummary,
) {
  const previousByKey = new Map<
    string,
    NonNullable<
      SingleAddressActivitySummary['scopes'][number]
    >['stores'][number]
  >();
  before.scopes.forEach((scope, scopeIndex) => {
    const scopeLabel = SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS[scopeIndex];
    scope?.stores.forEach(store => {
      previousByKey.set(`${scopeLabel}/${store.label}`, store);
    });
  });

  return after.scopes
    .flatMap((scope, scopeIndex) => {
      const scopeLabel = SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS[scopeIndex];
      return (scope?.stores || []).map(store => {
        const key = `${scopeLabel}/${store.label}`;
        const previous = previousByKey.get(key);
        return {
          scope: scopeLabel,
          store: store.label,
          consumerDelta: store.consumerCount - (previous?.consumerCount || 0),
          sourceNotificationDelta:
            store.sourceNotificationCount -
            (previous?.sourceNotificationCount || 0),
          publishedNotificationDelta:
            store.publishedNotificationCount -
            (previous?.publishedNotificationCount || 0),
          catchUpDelta: store.catchUpCount - (previous?.catchUpCount || 0),
        };
      });
    })
    .filter(
      store =>
        store.consumerDelta !== 0 ||
        store.sourceNotificationDelta !== 0 ||
        store.publishedNotificationDelta !== 0 ||
        store.catchUpDelta !== 0,
    );
}

function getSingleAddressChainProjectionCursor() {
  const records = getSingleAddressChainProjectionDiagnosticsSnapshot().records;
  return records[records.length - 1]?.id || 0;
}

function getSingleAddressChainProjectionRecordsAfter(cursor: number) {
  return getSingleAddressChainProjectionDiagnosticsSnapshot()
    .records.filter(record => record.id > cursor)
    .map(record => ({
      source: record.source,
      addressCount: record.addressCount,
      inputCount: record.inputCount,
      changed: record.changed,
      projectionMs: Math.round(record.projectionMs * 10) / 10,
      publishMs: Math.round(record.publishMs * 10) / 10,
      totalMs: Math.round(record.totalMs * 10) / 10,
    }));
}

function getAssetDataLoadDiagnosticsCursor() {
  const records = getAssetDataLoadDiagnosticsSnapshot().records;
  return records[records.length - 1]?.id || 0;
}

function getAssetDataLoadRecordsAfter(
  cursor: number,
  address: string,
  navigationStartedAt: number,
) {
  const normalizedAddress = address.toLowerCase();
  return getAssetDataLoadDiagnosticsSnapshot()
    .records.filter(
      record =>
        record.id > cursor &&
        record.address.toLowerCase() === normalizedAddress,
    )
    .map(record => ({
      domain: record.domain,
      requestId: record.requestId,
      phase: record.phase,
      sinceNavigationMs: record.timestamp - navigationStartedAt,
      elapsedMs: record.elapsedMs,
      deltaMs: record.deltaMs,
      details: record.details,
    }));
}

async function assertSingleAddressActivity(
  context: RegressionScenarioExecutionContext,
  options: {
    assertion: string;
    screenActive: boolean;
    expectedActiveTabLabel: string | null;
    requiredTabScopeLabels: readonly string[];
    details?: Record<string, unknown>;
  },
) {
  const requiredScopeLabels = new Set<string>([
    ...SINGLE_ADDRESS_SCREEN_ACTIVITY_SCOPE_LABELS,
    ...options.requiredTabScopeLabels,
  ]);
  const expectedActiveLabels = new Set<string>(
    options.screenActive
      ? [
          ...SINGLE_ADDRESS_SCREEN_ACTIVITY_SCOPE_LABELS,
          ...(options.expectedActiveTabLabel
            ? [options.expectedActiveTabLabel]
            : []),
        ]
      : [],
  );
  const sourceRequiredLabels = options.screenActive
    ? ['single-address', options.expectedActiveTabLabel].filter(
        (label): label is string => !!label,
      )
    : [];
  const startedAt = Date.now();
  let latest = summarizeSingleAddressActivityScopes();

  while (Date.now() - startedAt < 10_000) {
    latest = summarizeSingleAddressActivityScopes();
    const allRequiredScopesMounted = latest.scopes.every((scope, index) => {
      const label = SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS[index];
      return !requiredScopeLabels.has(label) || !!scope;
    });
    const activityMatches = latest.scopes.every((scope, index) => {
      if (!scope) {
        return true;
      }
      const label = SINGLE_ADDRESS_ACTIVITY_SCOPE_LABELS[index];
      const shouldBeActive = expectedActiveLabels.has(label);
      if (scope.active !== shouldBeActive) {
        return false;
      }
      if (!shouldBeActive) {
        return scope.stores.every(store => !store.sourceSubscribed);
      }
      return scope.stores.every(
        store => store.consumerCount === 0 || store.sourceSubscribed,
      );
    });
    const activeSourcesPresent = sourceRequiredLabels.every(label =>
      getLatestStoreActivityScopeDiagnostics(label)?.stores.some(
        store => store.consumerCount > 0 && store.sourceSubscribed,
      ),
    );

    if (
      latest.enabled &&
      allRequiredScopesMounted &&
      activityMatches &&
      activeSourcesPresent
    ) {
      context.report('assertion', {
        assertion: options.assertion,
        passed: true,
        screenActive: options.screenActive,
        expectedActiveTabLabel: options.expectedActiveTabLabel,
        scopes: latest.report,
        ...options.details,
      });
      return;
    }
    await delay(50);
  }

  context.report('assertion', {
    assertion: options.assertion,
    passed: false,
    screenActive: options.screenActive,
    expectedActiveTabLabel: options.expectedActiveTabLabel,
    scopes: latest.report,
    ...options.details,
  });
  throw new Error(
    `Single-address store activity did not converge for ${options.assertion}`,
  );
}

async function openSingleAddress(
  context: RegressionScenarioExecutionContext,
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number],
) {
  resetToHome();
  await context.waitForRoute(RootNames.Home);

  const probe = createRegressionScenarioPerformanceProbe();
  const navigationStartedAt = Date.now();
  const assetDataLoadCursor = getAssetDataLoadDiagnosticsCursor();
  probe.markPhase('navigate-to-single-address');
  try {
    apisSingleHome.navigateToSingleHome(account);
    await context.waitForRoute(RootNames.SingleAddressHome);
    probe.recordDuration('navigate-to-route', Date.now() - navigationStartedAt);
    context.report('assertion', {
      assertion: 'single-address-opened',
      passed: true,
      account: formatSafeAddress(account.address),
    });

    probe.markPhase('wait-for-asset-view');
    const settledViewEvent = await waitForScenarioAssertion(
      context,
      'single-address-asset-view-settled',
      15_000,
    );
    probe.recordDuration(
      'navigate-to-view-settled',
      Date.now() - navigationStartedAt,
    );
    const viewState = settledViewEvent.data?.viewState;
    if (viewState !== 'assets' && viewState !== 'receive') {
      throw new Error(`Unexpected single-address asset view: ${viewState}`);
    }

    const visitedTabScopeLabels: string[] = [];
    let expectedActiveTabLabel: string | null = null;
    if (viewState === 'assets') {
      for (const tab of SINGLE_ADDRESS_TAB_ACTIVITY) {
        probe.markPhase(`activate-${tab.name}`);
        const timing = await runRegressionScenarioComponentAction(
          context.command.runId,
          tab.action,
        );
        probe.recordAction(`activate-${tab.name}`, timing);
        visitedTabScopeLabels.push(tab.scopeLabel);
        expectedActiveTabLabel = tab.scopeLabel;
        probe.markPhase(`verify-${tab.name}-store-activity`);
        await assertSingleAddressActivity(context, {
          assertion: 'single-address-tab-store-activity',
          screenActive: true,
          expectedActiveTabLabel,
          requiredTabScopeLabels: visitedTabScopeLabels,
          details: {
            tab: tab.name,
            actionTiming: timing,
            viewState,
          },
        });

        if (tab.name !== 'defi') {
          const expandConfig = SINGLE_ADDRESS_EXPAND_ACTIONS[tab.name];
          probe.markPhase(`collapse-${tab.name}`);
          const collapseTiming = await runRegressionScenarioComponentAction(
            context.command.runId,
            expandConfig.collapseAction,
            15_000,
          );
          probe.recordAction(`collapse-${tab.name}`, collapseTiming);
          probe.markPhase(`wait-${tab.name}-content-ready`);
          const readyEvent = await waitForScenarioAssertion(
            context,
            expandConfig.readyAssertion,
            30_000,
          );
          probe.recordDuration(
            `${tab.name}-data-ready-from-navigation`,
            Date.now() - navigationStartedAt,
          );
          context.report('assertion', {
            assertion: `single-address-${tab.name}-data-ready`,
            passed: true,
            ...readyEvent.data,
          });
        }

        if (tab.name === 'defi') {
          continue;
        }
        const expandConfig = SINGLE_ADDRESS_EXPAND_ACTIONS[tab.name];
        const expandStartedAt = Date.now();
        const expandProbe = createRegressionScenarioPerformanceProbe();
        const activityBeforeExpand = summarizeSingleAddressActivityScopes();
        const chainProjectionCursor = getSingleAddressChainProjectionCursor();
        probe.markPhase(`expand-${tab.name}`);
        const expandTiming = await runRegressionScenarioComponentAction(
          context.command.runId,
          expandConfig.action,
          15_000,
        );
        probe.recordAction(`expand-${tab.name}`, expandTiming);
        probe.markPhase(`wait-${tab.name}-expanded`);
        const expandedEvent = await waitForScenarioAssertion(
          context,
          expandConfig.assertion,
          15_000,
          expandStartedAt,
        );
        probe.recordDuration(
          `expand-${tab.name}-settled`,
          Date.now() - expandStartedAt,
        );
        context.report('perf-mark', {
          mark: `single-address-${tab.name}-expand-performance`,
          ...expandProbe.stop(),
          storeActivityDelta: diffSingleAddressStoreActivity(
            activityBeforeExpand,
            summarizeSingleAddressActivityScopes(),
          ),
          chainProjections: getSingleAddressChainProjectionRecordsAfter(
            chainProjectionCursor,
          ),
        });
        context.report('assertion', {
          assertion: `single-address-${tab.name}-expand-complete`,
          passed: true,
          actionTiming: expandTiming,
          ...expandedEvent.data,
        });
      }
    } else {
      await assertSingleAddressActivity(context, {
        assertion: 'single-address-receive-store-activity',
        screenActive: true,
        expectedActiveTabLabel: null,
        requiredTabScopeLabels: visitedTabScopeLabels,
        details: {
          viewState,
        },
      });
    }

    probe.markPhase('hide-single-address');
    pushNestedScreen(RootNames.StackSettings, RootNames.Settings);
    await context.waitForRoute(RootNames.Settings);
    await assertSingleAddressActivity(context, {
      assertion: 'single-address-hidden-store-activity',
      screenActive: false,
      expectedActiveTabLabel: null,
      requiredTabScopeLabels: visitedTabScopeLabels,
      details: { viewState },
    });

    probe.markPhase('restore-single-address');
    navigationRef.dispatch(StackActions.pop(1));
    await context.waitForRoute(RootNames.SingleAddressHome);
    await assertSingleAddressActivity(context, {
      assertion: 'single-address-restored-store-activity',
      screenActive: true,
      expectedActiveTabLabel,
      requiredTabScopeLabels: visitedTabScopeLabels,
      details: { viewState },
    });
  } finally {
    probe.markPhase('complete');
    const performanceSummary = probe.stop();
    context.report('perf-mark', {
      mark: 'single-address-performance-summary',
      account: formatSafeAddress(account.address),
      assetDataLoads: getAssetDataLoadRecordsAfter(
        assetDataLoadCursor,
        account.address,
        navigationStartedAt,
      ),
      ...compactRegressionScenarioPerformanceSummary(performanceSummary),
    });
  }
}

async function openTokenDetail(
  context: RegressionScenarioExecutionContext,
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number],
) {
  const address = account.address.toLowerCase();
  const tokens = tokenStore.getState().tokenListMap[address] || [];
  const requestedTokenId = context.command.params.tokenId;
  const accountToken =
    tokens.find(item => item.id === requestedTokenId) ||
    [...tokens].sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0))[0];
  const fallbackChain = findChainByEnum(CHAINS_ENUM.ETH);
  const token =
    accountToken ||
    (fallbackChain ? makeTokenFromChain(fallbackChain) : undefined);
  if (!token) {
    throw new Error('Ethereum native token metadata is unavailable');
  }

  navigationRef.dispatch(
    StackActions.push(RootNames.TokenDetail, {
      token,
      isSingleAddress: true,
      account,
    }),
  );
  await context.waitForRoute(RootNames.TokenDetail);
  context.report('assertion', {
    assertion: 'token-detail-opened',
    passed: true,
    chain: token.chain,
    symbol: token.symbol,
    source: accountToken ? 'account-assets' : 'default-native-token',
  });
}

async function openSendReceive(
  context: RegressionScenarioExecutionContext,
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number],
) {
  await switchSceneCurrentAccount('MakeTransactionAbout', account);
  pushNestedScreen(RootNames.StackTransaction, RootNames.Send);
  await context.waitForRoute(RootNames.Send);
  context.report('assertion', {
    assertion: 'send-screen-opened',
    passed: true,
  });

  if (context.command.action === 'start') {
    pushNestedScreen(RootNames.StackTransaction, RootNames.Receive, {
      account,
    });
    await context.waitForRoute(RootNames.Receive);
    context.report('assertion', {
      assertion: 'receive-screen-opened',
      passed: true,
    });
    await waitForScenarioAssertion(context, 'receive-address-ready', 10_000);
  }
}

async function openSendTransfer(
  context: RegressionScenarioExecutionContext,
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
) {
  const shouldBroadcast = parseScenarioBoolean(
    context.command.params.broadcast,
  );
  const toAddress = readTransferToAddress(context);
  const chainEnum = readScenarioChain(context);
  const { targetUsd, maxTotalUsd } = readTargetUsd(context);
  const account = selectScenarioAccount(
    accounts,
    context.command.params.accountSuffix ||
      context.command.params.fundedAccountSuffix,
  );
  const plan = await resolveNativeTokenPlan({
    account,
    chainEnum,
    targetUsd,
    maxTotalUsd,
  });

  await switchSceneCurrentAccount('MakeTransactionAbout', account);
  apiSendToken.setChainEnum(chainEnum);
  apiSendToken.setCurrentToken(plan.token);
  pushNestedScreen(RootNames.StackTransaction, RootNames.Send, {
    chainEnum,
    tokenId: plan.token.id,
    toAddress,
    regressionRunId: context.command.runId,
  });
  await context.waitForRoute(RootNames.Send);
  requestSendTokenFormPatch({
    to: toAddress,
    amount: plan.amount,
  });
  context.report('assertion', {
    assertion: 'send-transfer-plan-ready',
    passed: true,
    mode: shouldBroadcast ? 'broadcast' : 'dry-run',
    account: formatSafeAddress(account.address),
    to: formatSafeAddress(toAddress),
    chain: plan.chain.serverId,
    token: plan.token.symbol,
    amount: plan.amount,
    targetUsd: targetUsd.toString(10),
    actualUsd: plan.actualUsd,
  });

  await waitForScenarioAssertion(
    context,
    shouldBroadcast
      ? 'send-transfer-broadcast-success'
      : 'send-transfer-dry-run-ready',
    shouldBroadcast ? 120_000 : 30_000,
  );
}

async function openSwapBridge(
  context: RegressionScenarioExecutionContext,
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
) {
  const account = selectScenarioAccount(
    accounts,
    context.command.params.accountSuffix ||
      context.command.params.fundedAccountSuffix,
  );
  await switchSceneCurrentAccount('MakeTransactionAbout', account);
  const requestedTab =
    context.command.params.tab === 'bridge' ? 'bridge' : 'swap';

  if (requestedTab === 'bridge') {
    const chainEnum = readScenarioChain(context);
    const toChainEnum = readBridgeToChain(context);
    const { targetUsd, maxTotalUsd } = readTargetUsd(context);
    const plan = await resolveStableTokenPlan({
      account,
      chainEnum,
      targetUsd,
      maxTotalUsd,
    });
    const toTokenId = StablecoinMapAggregatedByChain[toChainEnum]?.usdc;
    if (!toTokenId) {
      const toChain = findChainByEnum(toChainEnum);
      throw new Error(
        `No usdc token configured for ${toChain?.serverId || toChainEnum}`,
      );
    }

    pushNestedScreen(RootNames.StackTransaction, RootNames.SwapBridge, {
      activeTab: requestedTab,
      chainEnum,
      tokenId: plan.token.id,
      toChainEnum,
      toTokenId,
    });
    await context.waitForRoute(RootNames.SwapBridge);
    context.report('assertion', {
      assertion: 'bridge-funded-plan-ready',
      passed: true,
      mode: 'dry-run',
      account: formatSafeAddress(account.address),
      chain: plan.chain.serverId,
      token: plan.token.symbol,
      amount: plan.amount,
      toChain: findChainByEnum(toChainEnum)?.serverId || toChainEnum,
      targetUsd: targetUsd.toString(10),
      actualUsd: plan.actualUsd,
    });

    await waitForScenarioAssertion(
      context,
      'bridge-funded-dry-run-ready',
      90_000,
    );
    await runSwapBridgePressure(context, requestedTab);
    return;
  }

  pushNestedScreen(RootNames.StackTransaction, RootNames.SwapBridge, {
    activeTab: requestedTab,
  });
  await context.waitForRoute(RootNames.SwapBridge);
  context.report('assertion', {
    assertion: 'swap-bridge-opened',
    passed: true,
    activeTab: requestedTab,
  });

  let activeTab: 'swap' | 'bridge' = requestedTab;
  if (context.command.action === 'start') {
    const secondTab = requestedTab === 'swap' ? 'bridge' : 'swap';
    await runRegressionScenarioComponentAction(
      context.command.runId,
      `swap-bridge.activate-${secondTab}`,
    );
    await waitForScenarioAssertion(
      context,
      `swap-bridge-${secondTab}-active`,
      10_000,
    );
    context.report('assertion', {
      assertion: 'swap-bridge-second-tab-opened',
      passed: true,
      activeTab: secondTab,
    });
    activeTab = secondTab;
  }
  await runSwapBridgePressure(context, activeTab);
}

async function openSwapFunded(
  context: RegressionScenarioExecutionContext,
  accounts: Awaited<ReturnType<typeof getScenarioAccounts>>,
) {
  const shouldBroadcast = parseScenarioBoolean(
    context.command.params.broadcast,
  );
  const chainEnum = readScenarioChain(context);
  const { targetUsd, maxTotalUsd } = readTargetUsd(context);
  const account = selectScenarioAccount(
    accounts,
    context.command.params.accountSuffix ||
      context.command.params.fundedAccountSuffix,
  );
  const plan = await resolveNativeTokenPlan({
    account,
    chainEnum,
    targetUsd,
    maxTotalUsd,
  });

  await switchSceneCurrentAccount('MakeTransactionAbout', account);
  pushNestedScreen(RootNames.StackTransaction, RootNames.SwapBridge, {
    activeTab: 'swap',
    chainEnum,
    tokenId: plan.token.id,
    type: 'Sell',
  });
  await context.waitForRoute(RootNames.SwapBridge);
  context.report('assertion', {
    assertion: 'swap-funded-plan-ready',
    passed: true,
    mode: shouldBroadcast ? 'broadcast' : 'dry-run',
    account: formatSafeAddress(account.address),
    chain: plan.chain.serverId,
    token: plan.token.symbol,
    amount: plan.amount,
    targetUsd: targetUsd.toString(10),
    actualUsd: plan.actualUsd,
  });

  await waitForScenarioAssertion(
    context,
    shouldBroadcast
      ? 'swap-funded-broadcast-success'
      : 'swap-funded-dry-run-ready',
    shouldBroadcast ? 120_000 : 60_000,
  );
}

async function openSettingsRestart(
  context: RegressionScenarioExecutionContext,
) {
  if (context.command.params.authRecoveryFixture === 'post-keychain-reset') {
    resetToHome();
    await context.waitForRoute(RootNames.Home);

    const [{ setKeyringPasswordState }, preferenceApi, keychainApi] =
      await Promise.all([
        import('@/core/serviceApi/keyring'),
        import('@/core/serviceApi/preference'),
        import('@/core/apis/keychain'),
      ]);

    if (keychainApi.isAuthenticatedByBiometrics()) {
      throw new Error(
        'post-keychain-reset fixture requires a non-biometric keychain entry',
      );
    }

    await setKeyringPasswordState({
      version: 1,
      origin: 'user',
      pendingAuthTransition: 'disable-biometrics',
    });
    await preferenceApi.setPasswordIsAutoGeneratedDurably(false);
    context.report('assertion', {
      assertion: 'biometric-auth-recovery-fixture-persisted',
      fixture: 'post-keychain-reset',
      passed: true,
    });
    return;
  }

  pushNestedScreen(RootNames.StackSettings, RootNames.Settings);
  await context.waitForRoute(RootNames.Settings);
  context.report('assertion', {
    assertion: 'settings-opened',
    passed: true,
  });

  if (parseScenarioBoolean(context.command.params.verifyAuthRecovery)) {
    const [keyringApi, preferenceApi, keychainApi] = await Promise.all([
      import('@/core/serviceApi/keyring'),
      import('@/core/serviceApi/preference'),
      import('@/core/apis/keychain'),
    ]);
    const deadline = Date.now() + 5_000;
    let passwordState = await keyringApi.getKeyringPasswordState();
    let passwordIsAutoGenerated =
      await preferenceApi.getPasswordIsAutoGenerated();

    while (
      Date.now() < deadline &&
      (passwordState?.pendingAuthTransition === 'disable-biometrics' ||
        passwordIsAutoGenerated)
    ) {
      await delay(50);
      passwordState = await keyringApi.getKeyringPasswordState();
      passwordIsAutoGenerated =
        await preferenceApi.getPasswordIsAutoGenerated();
    }

    const passed =
      passwordState?.origin === 'user' &&
      !passwordState.pendingAuthTransition &&
      !passwordIsAutoGenerated &&
      !keychainApi.isAuthenticatedByBiometrics();
    context.report('assertion', {
      assertion: 'biometric-auth-state-recovered',
      passed,
      passwordOrigin: passwordState?.origin || null,
      pendingAuthTransition: passwordState?.pendingAuthTransition || null,
      passwordIsAutoGenerated,
      isBiometricAuthenticationType: keychainApi.isAuthenticatedByBiometrics(),
    });
    if (!passed) {
      throw new Error('Biometric authentication state did not converge');
    }
  }

  if (parseScenarioBoolean(context.command.params.lockAfterOpen)) {
    const { apisLock } = await import('@/core/apis');
    await apisLock.lockWallet();
    context.report('assertion', {
      assertion: 'wallet-locked-for-restart',
      passed: !apisLock.isUnlocked(),
    });
  }
}

async function openAppBackgroundRestore(
  context: RegressionScenarioExecutionContext,
) {
  resetToHome();
  await context.waitForRoute(RootNames.Home);
  context.report('assertion', {
    assertion: 'background-restore-precondition-home-ready',
    passed: true,
    route: navigationRef.getCurrentRoute()?.name || null,
  });
}

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  const { account, accounts } = await prepareScenario(context);
  context.report('precondition-ready', {
    walletUnlocked: true,
    accountCount: accounts.length,
  });
  context.report('action-started', {
    action: context.command.action,
  });

  switch (context.command.scenario) {
    case 'address-switch':
      await switchCurrentAddress(context, accounts);
      break;
    case 'home-assets':
      await openHomeAssets(context);
      break;
    case 'single-address': {
      const singleAddressAccount = selectScenarioAccount(
        accounts,
        context.command.params.accountSuffix,
      );
      if (
        parseScenarioBoolean(
          context.command.params.clearTokenMemoryBeforeNavigation,
        )
      ) {
        const normalizedAddress = singleAddressAccount.address.toLowerCase();
        const state = tokenStore.getState();
        const nextTokenListMap = { ...state.tokenListMap };
        const nextLoadingByAddress = { ...state.isLoadingByAddress };
        delete nextTokenListMap[normalizedAddress];
        delete nextLoadingByAddress[normalizedAddress];
        tokenStore.setState({
          tokenListMap: nextTokenListMap,
          isLoadingByAddress: nextLoadingByAddress,
        });
        context.report('assertion', {
          assertion: 'single-address-token-memory-cleared',
          passed:
            tokenStore.getState().tokenListMap[normalizedAddress] === undefined,
          account: formatSafeAddress(singleAddressAccount.address),
        });
      }
      if (
        parseScenarioBoolean(
          context.command.params.expireTokenCacheBeforeNavigation,
        )
      ) {
        await TokenItemEntity.willExpired(singleAddressAccount.address);
        const cacheExpired = await TokenItemEntity.isExpired(
          singleAddressAccount.address,
        );
        context.report('assertion', {
          assertion: 'single-address-token-cache-expired',
          passed: cacheExpired,
          account: formatSafeAddress(singleAddressAccount.address),
        });
        if (!cacheExpired) {
          throw new Error('Single-address token cache did not expire');
        }
      }
      await openSingleAddress(context, singleAddressAccount);
      break;
    }
    case 'token-detail':
      await openTokenDetail(context, account);
      break;
    case 'send-receive':
      await openSendReceive(context, account);
      break;
    case 'send-transfer':
      await openSendTransfer(context, accounts);
      break;
    case 'swap-bridge':
      await openSwapBridge(context, accounts);
      break;
    case 'swap-funded':
      await openSwapFunded(context, accounts);
      break;
    case 'settings-restart':
      await openSettingsRestart(context);
      break;
    case 'app-background-restore':
      await openAppBackgroundRestore(context);
      break;
    default:
      throw new Error(
        `Unsupported core navigation scenario: ${context.command.scenario}`,
      );
  }

  context.report('postcondition-ready', {
    route: navigationRef.getCurrentRoute()?.name || null,
  });
}
