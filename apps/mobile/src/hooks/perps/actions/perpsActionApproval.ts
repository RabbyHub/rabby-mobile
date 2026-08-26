import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  PERPS_BUILD_FEE_RECEIVE_ADDRESS,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { apisKeyring } from '@/core/apis/keyring';
import { apisPerps } from '@/core/apis/perps';
import { sendRequest } from '@/core/apis/sendRequest';
import type { Account } from '@/core/startupServices/preference';
import { miniSignTypedData } from '@/hooks/useMiniSignTypedData';
import {
  fetchUserAbstraction,
  perpsStore,
  setAccountNeedApproveAgent,
  setAccountNeedApproveBuilderFee,
} from '@/hooks/perps/usePerpsStore';
import { sleep } from '@/utils/async';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import { isSamePerpsActionAccount } from './accountGuard';
import { PerpsActionUserCancelledError } from './actionError';
import { setPerpsAgentUnifiedAccount } from './setAgentUnifiedAccount';

type ApprovalAction = {
  action: any;
  signature: string;
  type: 'approveAgent' | 'approveBuilderFee';
};

const accountKey = (account: Pick<Account, 'address' | 'type'>) =>
  `${account.address.toLowerCase()}:${account.type}`;

const assertCurrentAccount = (expectedAccount: Account) => {
  if (
    !isSamePerpsActionAccount(
      perpsStore.getState().currentPerpsAccount,
      expectedAccount,
    )
  ) {
    throw new Error('Perps account changed');
  }
};

const executeApprovalSignatures = async (
  actions: ApprovalAction[],
  account: Account,
) => {
  const isLocalWallet =
    account.type === KEYRING_CLASS.PRIVATE_KEY ||
    account.type === KEYRING_CLASS.MNEMONIC;
  const useMiniApprovalSign =
    account.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
    account.type === KEYRING_CLASS.HARDWARE.LEDGER;

  if (useMiniApprovalSign) {
    try {
      const results = await miniSignTypedData({
        account,
        txs: actions.map(item => ({
          data: item.action,
          from: account.address,
          version: 'V4',
        })),
      });
      results.forEach((item, index) => {
        const action = actions[index];
        if (action) {
          action.signature = item.txHash;
        }
      });
      return;
    } catch {
      throw new PerpsActionUserCancelledError();
    }
  }

  for (const item of actions) {
    item.signature = isLocalWallet
      ? await apisKeyring.signTypedData(
          account.type,
          account.address,
          item.action,
          { version: 'V4' },
        )
      : await sendRequest({
          account,
          data: {
            method: 'eth_signTypedDataV4',
            params: [account.address, JSON.stringify(item.action)],
          },
          session: INTERNAL_REQUEST_SESSION,
        });
  }
};

const applyApprovalActions = async (actions: ApprovalAction[]) => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  await Promise.all(
    actions.map(item =>
      item.type === 'approveAgent'
        ? exchange.sendApproveAgent({
            action: item.action?.message,
            nonce: item.action?.nonce || 0,
            signature: item.signature,
          })
        : exchange.sendApproveBuilderFee({
            action: item.action?.message,
            nonce: item.action?.nonce || 0,
            signature: item.signature,
          }),
    ),
  );
};

const syncPostApprovalConfiguration = async (account: Account) => {
  if (
    !isSamePerpsActionAccount(
      perpsStore.getState().currentPerpsAccount,
      account,
    )
  ) {
    return;
  }
  const exchange = apisPerps.getPerpsSDK().exchange;
  try {
    await setPerpsAgentUnifiedAccount(exchange);
  } catch {
    try {
      await exchange?.agentEnableDexAbstraction();
    } catch {
      // Best effort: the approval itself has already completed.
    }
  } finally {
    setTimeout(() => {
      if (
        isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          account,
        )
      ) {
        void fetchUserAbstraction(account).catch(() => undefined);
      }
    }, 100);
  }

  setTimeout(() => {
    if (
      isSamePerpsActionAccount(
        perpsStore.getState().currentPerpsAccount,
        account,
      )
    ) {
      void exchange?.setReferrer(PERPS_REFERENCE_CODE).catch(() => undefined);
    }
  }, 100);
};

const runApproval = async (expectedAccount: Account) => {
  assertCurrentAccount(expectedAccount);
  const state = perpsStore.getState();
  const sdk = apisPerps.getPerpsSDK();
  const exchange = sdk.exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }

  const signer = await apisPerps.applyPerpsSigner(expectedAccount);
  assertCurrentAccount(expectedAccount);

  const actions: ApprovalAction[] = [];
  if (
    !signer.isSelfSign &&
    (state.accountNeedApproveAgent || signer.isCreate)
  ) {
    actions.push({
      action: exchange.prepareApproveAgent(),
      signature: '',
      type: 'approveAgent',
    });
  }
  if (state.accountNeedApproveBuilderFee) {
    await sleep(10);
    actions.push({
      action: exchange.prepareApproveBuilderFee({
        builder: PERPS_BUILD_FEE_RECEIVE_ADDRESS,
      }),
      signature: '',
      type: 'approveBuilderFee',
    });
  }

  if (actions.length === 0) {
    if (signer.isSelfSign && state.accountNeedApproveAgent) {
      setAccountNeedApproveAgent(false);
    }
    return;
  }

  await executeApprovalSignatures(actions, expectedAccount);
  assertCurrentAccount(expectedAccount);
  await applyApprovalActions(actions);
  await sleep(100);
  assertCurrentAccount(expectedAccount);
  setAccountNeedApproveAgent(false);
  setAccountNeedApproveBuilderFee(false);
  void syncPostApprovalConfiguration(expectedAccount);
};

let activeApproval: { accountKey: string; promise: Promise<void> } | undefined;

export const ensurePerpsActionApproval = async (expectedAccount: Account) => {
  const key = accountKey(expectedAccount);
  if (activeApproval) {
    const active = activeApproval;
    await active.promise;
    assertCurrentAccount(expectedAccount);
    if (active.accountKey === key) {
      return;
    }
  }

  const promise = runApproval(expectedAccount).finally(() => {
    if (activeApproval?.promise === promise) {
      activeApproval = undefined;
    }
  });
  activeApproval = { accountKey: key, promise };
  return promise;
};
