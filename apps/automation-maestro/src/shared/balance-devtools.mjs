import fs from 'node:fs';
import path from 'node:path';
import { waitForRabbyDevtoolsBridgeMethod } from './devtools.mjs';

export function unwrapBridgeValue(payload) {
  return payload?.result?.value ?? null;
}

export function writeJsonArtifact(outputDir, filename, value) {
  fs.writeFileSync(
    path.join(outputDir, filename),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function assertHomeSnapshotStable(snapshot, { expectedFolded } = {}) {
  const displayAddresses = snapshot?.displayAddressesState?.displayAddresses;
  if (!Array.isArray(displayAddresses) || displayAddresses.length === 0) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: no Home display addresses were resolved',
    );
  }

  if (snapshot?.uiState?.showBalanceLoadingWithoutLocal) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home balance is still in loading-without-local-data state',
    );
  }

  if (snapshot?.curveUiState?.balanceLoadingWithoutLocal) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home curve UI still reports balance-loading-without-local-data',
    );
  }

  if (snapshot?.curveUiState?.changeLoading) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home change state is still loading',
    );
  }

  if (snapshot?.curveUiState?.isCurveLoading) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home curve state is still loading',
    );
  }

  if (!snapshot?.balanceSummary?.flow?.hasAnyValue) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home balance summary has no value',
    );
  }

  if (!isFiniteNumber(snapshot?.balanceSummary?.totalBalance)) {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home totalBalance is not finite',
    );
  }

  if (
    typeof expectedFolded === 'boolean' &&
    snapshot?.curveUiState?.isFolded !== expectedFolded
  ) {
    throw new Error(
      `[maestro:home-balance] DevTools validation failed: expected Home curve folded=${expectedFolded}, got ${snapshot?.curveUiState?.isFolded}`,
    );
  }
}

export async function waitForStableHomeSnapshot({
  appId,
  expectedFolded,
  timeoutMs = 45000,
  intervalMs = 1000,
}) {
  const payload = await waitForRabbyDevtoolsBridgeMethod({
    appId,
    method: 'getHomePortfolioSnapshot',
    timeoutMs,
    intervalMs,
    accept: value => {
      try {
        assertHomeSnapshotStable(value, { expectedFolded });
        return true;
      } catch {
        return false;
      }
    },
  });

  const snapshot = unwrapBridgeValue(payload);
  assertHomeSnapshotStable(snapshot, { expectedFolded });
  return { payload, snapshot };
}

export function assertSingleHomeSnapshotStable(
  snapshot,
  { expectedFolded } = {},
) {
  if (!snapshot?.hasCurrentAddress || !snapshot?.currentAddress) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: no current single-home address is selected',
    );
  }

  if (!isFiniteNumber(snapshot?.balanceValue?.totalBalance)) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home totalBalance is not finite',
    );
  }

  if (snapshot?.uiState?.balanceLoadingWithoutLocal) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home balance is still loading without local data',
    );
  }

  if (snapshot?.uiState?.isLoadingChartData) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home chart data is still loading',
    );
  }

  if (snapshot?.uiState?.changeLoading) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home change state is still loading',
    );
  }

  if (snapshot?.curveUiState?.isCurveLoading) {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home curve state is still loading',
    );
  }

  if (
    typeof expectedFolded === 'boolean' &&
    snapshot?.curveUiState?.isFolded !== expectedFolded
  ) {
    throw new Error(
      `[maestro:single-home] DevTools validation failed: expected single-home curve folded=${expectedFolded}, got ${snapshot?.curveUiState?.isFolded}`,
    );
  }
}

export async function waitForStableSingleHomeSnapshot({
  appId,
  expectedFolded,
  timeoutMs = 45000,
  intervalMs = 1000,
}) {
  const payload = await waitForRabbyDevtoolsBridgeMethod({
    appId,
    method: 'getSingleHomeSnapshot',
    timeoutMs,
    intervalMs,
    accept: value => {
      try {
        assertSingleHomeSnapshotStable(value, { expectedFolded });
        return true;
      } catch {
        return false;
      }
    },
  });

  const snapshot = unwrapBridgeValue(payload);
  assertSingleHomeSnapshotStable(snapshot, { expectedFolded });
  return { payload, snapshot };
}
