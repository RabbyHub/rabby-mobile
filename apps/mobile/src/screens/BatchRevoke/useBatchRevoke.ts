import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
  useApprovalsPage,
} from '../Approvals/useApprovalsPage';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { findIndexRevokeList } from './utils';
import { useRevokeOne } from './useRevokeOne';
import { useApprovalAlertCounts } from '../Home/hooks/approvals';

export const useBatchRevoke = () => {
  const handleRevokeOne = useRevokeOne();
  const { forceUpdate } = useApprovalAlertCounts(10 * 60 * 1000);
  const { loadApprovals } = useApprovalsPage();
  const handleRevoke = React.useCallback(
    (
      revokeList: ApprovalSpenderItemToBeRevoked[],
      dataSource: AssetApprovalSpender[],
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
      navigate(RootNames.StackTransaction, {
        screen: RootNames.BatchRevoke,
        params: {
          revokeList: revokeList,
          dataSource: filteredDataSource,
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
      if (revokeList.length === 1) {
        forceUpdate();
        await handleRevokeOne(revokeList[0]);
        loadApprovals();
        return;
      }
      return handleRevoke(revokeList, dataSource);
    },
    [handleRevoke, handleRevokeOne, forceUpdate, loadApprovals],
  );

  return batchRevoke;
};
