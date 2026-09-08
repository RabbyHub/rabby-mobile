import {
  PERPS_AGENT_NAME,
  PERPS_BUILD_FEE_RECEIVE_ADDRESS,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchUserAbstraction,
  perpsStore,
  setAccountNeedApproveAgent,
  setAccountNeedApproveBuilderFee,
} from '@/hooks/perps/usePerpsStore';
import { sleep } from '@/utils/async';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { isSamePerpsActionAccount } from './accountGuard';
import { setPerpsAgentUnifiedAccount } from './setAgentUnifiedAccount';
import { signPerpsTypedDataActions } from './perpsTypedDataSignatures';

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

export type PerpsActionApprovalRequirements = Readonly<{
  builderFee?: boolean;
  forceRemoteCheck?: boolean;
}>;

const AGENT_EXPIRY_SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000;
const REMOTE_APPROVAL_STATUS_TTL_MS = 30_000;

type RemoteApprovalStatus = Readonly<{
  agentExpired: boolean;
  builderFeeApproved: boolean;
}>;

const remoteApprovalStatusCache = new Map<
  string,
  { checkedAt: number; status: RemoteApprovalStatus }
>();

const remoteStatusKey = (
  account: Account,
  agentAddress: string,
  builderFee: boolean,
) => `${accountKey(account)}:${agentAddress.toLowerCase()}:${builderFee}`;

const fetchRemoteApprovalStatus = async ({
  account,
  agentAddress,
  builderFee,
  forceRemoteCheck,
}: {
  account: Account;
  agentAddress: string;
  builderFee: boolean;
  forceRemoteCheck: boolean;
}): Promise<RemoteApprovalStatus> => {
  const key = remoteStatusKey(account, agentAddress, builderFee);
  const cached = remoteApprovalStatusCache.get(key);
  if (
    !forceRemoteCheck &&
    cached &&
    Date.now() - cached.checkedAt < REMOTE_APPROVAL_STATUS_TTL_MS
  ) {
    return cached.status;
  }

  const sdk = apisPerps.getPerpsSDK();
  const [extraAgents, maxBuilderFee] = await Promise.all([
    sdk.info.extraAgents(account.address),
    builderFee
      ? sdk.info.getMaxBuilderFee(
          PERPS_BUILD_FEE_RECEIVE_ADDRESS,
          account.address,
        )
      : Promise.resolve('not-required'),
  ]);
  const agent = extraAgents.find(item =>
    isSameAddress(item.address, agentAddress),
  );
  const status = {
    agentExpired:
      !agent?.validUntil ||
      agent.validUntil < Date.now() + AGENT_EXPIRY_SAFETY_WINDOW_MS,
    builderFeeApproved: !builderFee || !!maxBuilderFee,
  };
  remoteApprovalStatusCache.set(key, { checkedAt: Date.now(), status });
  return status;
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

const runApproval = async (
  expectedAccount: Account,
  requirements: PerpsActionApprovalRequirements,
) => {
  assertCurrentAccount(expectedAccount);
  const state = perpsStore.getState();
  const sdk = apisPerps.getPerpsSDK();
  const exchange = sdk.exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }

  let signer = await apisPerps.applyPerpsSigner(expectedAccount);
  assertCurrentAccount(expectedAccount);

  const requiresBuilderFee = requirements.builderFee !== false;
  let remoteStatus: RemoteApprovalStatus = {
    agentExpired: false,
    builderFeeApproved: !requiresBuilderFee,
  };
  if (!signer.isSelfSign) {
    remoteStatus = await fetchRemoteApprovalStatus({
      account: expectedAccount,
      agentAddress: signer.agentAddress,
      builderFee: requiresBuilderFee,
      // Local flags are invalidation hints, not proof that a remote approval is
      // missing. Recheck the server, then let that authoritative result decide
      // whether a signature is required.
      forceRemoteCheck:
        requirements.forceRemoteCheck === true ||
        state.accountNeedApproveAgent ||
        (requiresBuilderFee && state.accountNeedApproveBuilderFee),
    });
    assertCurrentAccount(expectedAccount);

    if (remoteStatus.agentExpired && !signer.isCreate) {
      const extraAgents = await sdk.info.extraAgents(expectedAccount.address);
      assertCurrentAccount(expectedAccount);
      const hasReplaceableAgentName = extraAgents.some(
        agent => agent.name === PERPS_AGENT_NAME,
      );
      if (!hasReplaceableAgentName && extraAgents.length >= 3) {
        setAccountNeedApproveAgent(true);
        throw new Error('Agent limit reached');
      }
      const nextAgent = await apisPerps.createPerpsAgentWallet(
        expectedAccount.address,
      );
      assertCurrentAccount(expectedAccount);
      apisPerps.initPerpsAgentAccount(
        expectedAccount.address,
        nextAgent.vault,
        nextAgent.agentAddress,
      );
      signer = {
        agentAddress: nextAgent.agentAddress,
        isCreate: true,
        isSelfSign: false,
      };
      remoteApprovalStatusCache.clear();
    }
  } else if (requiresBuilderFee) {
    const maxBuilderFee = await sdk.info.getMaxBuilderFee(
      PERPS_BUILD_FEE_RECEIVE_ADDRESS,
      expectedAccount.address,
    );
    remoteStatus = {
      agentExpired: false,
      builderFeeApproved: !!maxBuilderFee,
    };
    assertCurrentAccount(expectedAccount);
  }

  const actions: ApprovalAction[] = [];
  if (!signer.isSelfSign && remoteStatus.agentExpired) {
    actions.push({
      action: exchange.prepareApproveAgent(),
      signature: '',
      type: 'approveAgent',
    });
  }
  if (requiresBuilderFee && !remoteStatus.builderFeeApproved) {
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
    if (state.accountNeedApproveAgent) {
      setAccountNeedApproveAgent(false);
    }
    if (requiresBuilderFee && state.accountNeedApproveBuilderFee) {
      setAccountNeedApproveBuilderFee(false);
    }
    return;
  }

  await signPerpsTypedDataActions(actions, expectedAccount);
  assertCurrentAccount(expectedAccount);
  await applyApprovalActions(actions);
  await sleep(100);
  assertCurrentAccount(expectedAccount);
  setAccountNeedApproveAgent(false);
  if (requiresBuilderFee) {
    setAccountNeedApproveBuilderFee(false);
  }
  remoteApprovalStatusCache.clear();
  void syncPostApprovalConfiguration(expectedAccount);
};

let activeApproval:
  | {
      accountKey: string;
      builderFee: boolean;
      promise: Promise<void>;
    }
  | undefined;

export const ensurePerpsActionApproval = async (
  expectedAccount: Account,
  requirements: PerpsActionApprovalRequirements = {},
) => {
  const key = accountKey(expectedAccount);
  const builderFee = requirements.builderFee !== false;
  if (activeApproval) {
    const active = activeApproval;
    await active.promise;
    assertCurrentAccount(expectedAccount);
    if (active.accountKey === key && (!builderFee || active.builderFee)) {
      return;
    }
  }

  const promise = runApproval(expectedAccount, requirements).finally(() => {
    if (activeApproval?.promise === promise) {
      activeApproval = undefined;
    }
  });
  activeApproval = { accountKey: key, builderFee, promise };
  return promise;
};

export const invalidatePerpsActionApprovalCache = () => {
  remoteApprovalStatusCache.clear();
};
