import { RootNames } from '@/constant/layout';
import { apiApprovals } from '@/core/apis';
import { naviPush } from '@/utils/navigation';
import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
  useApprovalsPage,
} from '../Approvals/useApprovalsPage';
import { useApprovalAlertCounts } from '../Home/hooks/approvals';
import { useRevokeOne } from './useRevokeOne';
import { findIndexRevokeList } from './utils';
import { Account } from '@/core/services/preference';
import { isAccountSupportMiniApproval } from '@/utils/account';

export const useBatchRevoke = ({
  account: currentAccount,
}: {
  account: Account;
}) => {
  const handleRevokeOne = useRevokeOne();
  const { forceUpdate } = useApprovalAlertCounts(10 * 60 * 1000);
  const { loadApprovals } = useApprovalsPage();

  const handleRevoke = React.useCallback(
    (
      revokeList: ApprovalSpenderItemToBeRevoked[],
      dataSource: AssetApprovalSpender[],
      account: Account,
    ) => {
      const filteredDataSource = dataSource.filter(record => {
        return (
          findIndexRevokeList(revokeList, {
            item: record.$assetContract!,
            spenderHost: record.$assetToken!,
            assetApprovalSpender: record,
          }) > -1
        );
      });
      naviPush(RootNames.StackTransaction, {
        screen: RootNames.BatchRevoke,
        params: {
          revokeList: revokeList,
          dataSource: filteredDataSource,
          account,
        },
      });
    },
    [],
  );

  const batchRevoke = React.useCallback(
    async (
      revokeList: ApprovalSpenderItemToBeRevoked[],
      dataSource: AssetApprovalSpender[],
    ) => {
      if (revokeList.length === 0) {
        return;
      }
      // not support batch revoke
      if (
        currentAccount &&
        !isAccountSupportMiniApproval(currentAccount?.type)
      ) {
        forceUpdate();
        await apiApprovals.revoke({
          list: revokeList,
          account: currentAccount,
        });
        loadApprovals();
        return;
      }

      // only one item
      if (revokeList.length === 1) {
        forceUpdate();

        await handleRevokeOne(revokeList[0], currentAccount);
        loadApprovals();
        return;
      }

      // batch revoke
      return handleRevoke(revokeList, dataSource, currentAccount);
    },
    [currentAccount, handleRevoke, forceUpdate, handleRevokeOne, loadApprovals],
  );

  return batchRevoke;
};
