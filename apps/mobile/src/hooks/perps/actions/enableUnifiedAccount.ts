import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchUserAbstraction,
  getPerpsAccountRuntimeContext,
  invalidateUserAbstractionCache,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { sleep } from '@/utils/async';
import {
  UserAbstraction,
  UserAbstractionResp,
} from '@rabby-wallet/hyperliquid-sdk';

import { isSamePerpsActionAccount } from './accountGuard';
import { signPerpsTypedDataActions } from './perpsTypedDataSignatures';

const assertUnifiedActionContext = (
  expectedAccount: Account,
  expectedGeneration: number,
) => {
  const runtime = getPerpsAccountRuntimeContext();
  if (
    runtime.generation !== expectedGeneration ||
    !isSamePerpsActionAccount(runtime.account, expectedAccount) ||
    !isSamePerpsActionAccount(
      perpsStore.getState().currentPerpsAccount,
      expectedAccount,
    )
  ) {
    throw new Error('Perps account changed');
  }
};

export const isPerpsUnifiedCollateralMode = (value: UserAbstractionResp) =>
  value === UserAbstractionResp.unifiedAccount ||
  value === UserAbstractionResp.portfolioMargin;

export const executeEnablePerpsUnifiedAccount = async (
  expectedAccount: Account,
) => {
  const generation = getPerpsAccountRuntimeContext().generation;
  assertUnifiedActionContext(expectedAccount, generation);

  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  const prepared = exchange.prepareUserSetAbstraction({
    abstraction: UserAbstraction.UNIFIED_ACCOUNT,
    user: expectedAccount.address,
  });
  if (!prepared) {
    throw new Error('Failed to prepare Unified Account request');
  }

  const signAction = {
    action: {
      domain: prepared.domain,
      message: prepared.message,
      primaryType: prepared.primaryType,
      types: prepared.types,
    },
    signature: '',
  };
  await signPerpsTypedDataActions([signAction], expectedAccount);
  assertUnifiedActionContext(expectedAccount, generation);

  const response = await exchange.sendUserSetAbstraction({
    action: prepared.message,
    nonce: prepared.nonce,
    signature: signAction.signature,
  });
  if (response?.status !== 'ok') {
    throw new Error('Hyperliquid rejected Unified Account configuration');
  }

  await invalidateUserAbstractionCache(expectedAccount.address);

  let lastRefreshError: unknown;
  for (const delay of [100, 200, 400]) {
    await sleep(delay);
    assertUnifiedActionContext(expectedAccount, generation);
    try {
      await fetchUserAbstraction(expectedAccount);
      lastRefreshError = undefined;
    } catch (error) {
      lastRefreshError = error;
      continue;
    }
    assertUnifiedActionContext(expectedAccount, generation);
    const state = perpsStore.getState();
    if (
      isPerpsUserAbstractionReadyForAccount(state, expectedAccount) &&
      isPerpsUnifiedCollateralMode(state.userAbstraction)
    ) {
      return;
    }
  }
  if (lastRefreshError instanceof Error) {
    throw lastRefreshError;
  }
  throw new Error('Unified Account state is not ready');
};
