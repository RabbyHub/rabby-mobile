import { waitForRabbyDevtoolsBridgeMethod } from './devtools.mjs';
import { unwrapBridgeValue } from './balance-devtools.mjs';

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

export function assertSendSnapshotMatches(
  snapshot,
  {
    fromAddress,
    toAddress,
    tokenChain,
    tokenId,
    amount,
    canSubmit,
    latestTxStatus,
    latestTxTo,
    latestTxAmount,
    latestTxTokenId,
  } = {},
) {
  if (snapshot?.routeName !== 'Send') {
    throw new Error(
      `[maestro:send-smoke] Expected routeName=Send, got ${snapshot?.routeName}`,
    );
  }

  if (!snapshot?.screenState?.inited) {
    throw new Error(
      '[maestro:send-smoke] Send screen is not initialized yet',
    );
  }

  if (snapshot?.screenState?.isLoading || snapshot?.screenState?.showBalanceLoading) {
    throw new Error(
      '[maestro:send-smoke] Send screen is still loading current token balance',
    );
  }

  if (
    fromAddress &&
    normalizeAddress(snapshot?.currentAccount?.address) !==
      normalizeAddress(fromAddress)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected from address ${fromAddress}, got ${snapshot?.currentAccount?.address}`,
    );
  }

  if (
    toAddress &&
    normalizeAddress(snapshot?.formValues?.to) !== normalizeAddress(toAddress)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected to address ${toAddress}, got ${snapshot?.formValues?.to}`,
    );
  }

  if (
    tokenChain &&
    String(snapshot?.currentToken?.chain || '').toLowerCase() !==
      String(tokenChain).toLowerCase()
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected token chain ${tokenChain}, got ${snapshot?.currentToken?.chain}`,
    );
  }

  if (
    tokenId &&
    normalizeAddress(snapshot?.currentToken?.id) !== normalizeAddress(tokenId)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected token id ${tokenId}, got ${snapshot?.currentToken?.id}`,
    );
  }

  if (amount != null && String(snapshot?.formValues?.amount || '') !== String(amount)) {
    throw new Error(
      `[maestro:send-smoke] Expected amount ${amount}, got ${snapshot?.formValues?.amount}`,
    );
  }

  if (
    typeof canSubmit === 'boolean' &&
    Boolean(snapshot?.computed?.canSubmit) !== canSubmit
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected canSubmit=${canSubmit}, got ${snapshot?.computed?.canSubmit}`,
    );
  }

  if (
    latestTxStatus &&
    String(snapshot?.latestTx?.status || '').toLowerCase() !==
      String(latestTxStatus).toLowerCase()
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected latestTx.status=${latestTxStatus}, got ${snapshot?.latestTx?.status}`,
    );
  }

  if (
    latestTxTo &&
    normalizeAddress(snapshot?.latestTx?.to) !== normalizeAddress(latestTxTo)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected latestTx.to=${latestTxTo}, got ${snapshot?.latestTx?.to}`,
    );
  }

  if (
    latestTxAmount != null &&
    String(snapshot?.latestTx?.amount ?? '') !== String(latestTxAmount)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected latestTx.amount=${latestTxAmount}, got ${snapshot?.latestTx?.amount}`,
    );
  }

  if (
    latestTxTokenId &&
    normalizeAddress(snapshot?.latestTx?.token?.id) !==
      normalizeAddress(latestTxTokenId)
  ) {
    throw new Error(
      `[maestro:send-smoke] Expected latestTx.token.id=${latestTxTokenId}, got ${snapshot?.latestTx?.token?.id}`,
    );
  }
}

export async function waitForStableSendSnapshot({
  appId,
  expected = {},
  timeoutMs = 45000,
  intervalMs = 1000,
}) {
  const payload = await waitForRabbyDevtoolsBridgeMethod({
    appId,
    method: 'getSendScreenSnapshot',
    timeoutMs,
    intervalMs,
    accept: value => {
      try {
        assertSendSnapshotMatches(value, expected);
        return true;
      } catch {
        return false;
      }
    },
  });

  const snapshot = unwrapBridgeValue(payload);
  assertSendSnapshotMatches(snapshot, expected);
  return {
    payload,
    snapshot,
  };
}
