import { useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import { ApprovalStatus } from '@rabby-wallet/rabby-api/dist/types';

const approvalStatusAtom = atom<ApprovalStatus[]>([]);

export function useApprovalAlert() {
  const { currentAccount } = useCurrentAccount();
  const [approvalState, setApprovalState] = useAtom(approvalStatusAtom);

  const [{ loading: loadingMaybeWrong, error }, loadApprovalStatus] =
    useAsyncFn(async () => {
      if (currentAccount?.address) {
        // const apiLevel = await openapi.getAPIConfig([], 'ApiLevel', false);
        // if (apiLevel < 1) {
        // } else {
        //   return [];
        // }

        try {
          const data = await openapi.approvalStatus(currentAccount.address);
          setApprovalState(data);
        } catch (error) {}
      }
      return;
    }, [currentAccount?.address]);

  useEffect(() => {
    loadApprovalStatus();
  }, [loadApprovalStatus]);

  const approvalRiskAlert = useMemo(() => {
    return approvalState.reduce(
      (pre, now) =>
        pre + now.nft_approval_danger_cnt + now.token_approval_danger_cnt,
      0,
    );
  }, [approvalState]);

  return {
    loadApprovalStatus,
    approvalRiskAlert,
  };
}
