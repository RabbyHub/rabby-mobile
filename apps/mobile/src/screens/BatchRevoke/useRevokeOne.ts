import { useMiniApproval } from '@/hooks/useMiniApproval';
import { ApprovalSpenderItemToBeRevoked } from '../Approvals/useApprovalsPage';
import React from 'react';
import { buildTx } from './useBatchRevokeTask';

export const useRevokeOne = () => {
  const { sendMiniTransactions } = useMiniApproval();

  const handleRevokeOne = React.useCallback(
    async (revokeItem: ApprovalSpenderItemToBeRevoked) => {
      const tx = await buildTx(revokeItem);
      return sendMiniTransactions({
        txs: [tx],
      });
    },
    [sendMiniTransactions],
  );

  return handleRevokeOne;
};
