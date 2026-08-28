import type { Account } from '@/core/startupServices/preference';
import type { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

import { isSamePerpsFundingAccount } from './accountGuard';

type PerpsWithdrawRuntimeContext = Readonly<{
  account: Account | null;
  generation: number;
}>;

export const createPerpsWithdrawLiveAbstractionQuery = ({
  account,
  generation,
  getRuntimeContext,
  query,
  reconcile,
}: {
  account: Account;
  generation: number;
  getRuntimeContext: () => PerpsWithdrawRuntimeContext;
  query: (address: string) => Promise<UserAbstractionResp>;
  reconcile: (userAbstraction: UserAbstractionResp) => boolean;
}) => {
  const hasExpectedRuntime = () => {
    const runtime = getRuntimeContext();
    return (
      runtime.generation === generation &&
      isSamePerpsFundingAccount(runtime.account, account)
    );
  };

  return async (): Promise<UserAbstractionResp | null> => {
    if (!hasExpectedRuntime()) {
      return null;
    }
    const remoteUserAbstraction = await query(account.address);
    if (!hasExpectedRuntime()) {
      return null;
    }
    return reconcile(remoteUserAbstraction) ? remoteUserAbstraction : null;
  };
};
