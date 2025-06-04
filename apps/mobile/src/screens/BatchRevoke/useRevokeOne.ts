import { useMiniApproval } from '@/hooks/useMiniApproval';
import { ApprovalSpenderItemToBeRevoked } from '../Approvals/useApprovalsPage';
import React from 'react';
import { buildTx } from './useBatchRevokeTask';
import { Account } from '@/core/services/preference';

export const useRevokeOne = () => {
  const { sendMiniTransactions } = useMiniApproval();

  const handleRevokeOne = React.useCallback(
    async (revokeItem: ApprovalSpenderItemToBeRevoked, account: Account) => {
      const tx = await buildTx(revokeItem, account);
      return sendMiniTransactions({
        txs: [tx],
        account,
      });
    },
    [sendMiniTransactions],
  );

  return handleRevokeOne;
};
