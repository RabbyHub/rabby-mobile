import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
} from '../Approvals/useApprovalsPage';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { findIndexRevokeList } from './utils';
import { useRevokeOne } from './useRevokeOne';

export const useBatchRevoke = () => {
  const handleRevokeOne = useRevokeOne();

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
    (
      revokeList: ApprovalSpenderItemToBeRevoked[],
      dataSource: AssetApprovalSpender[],
    ) => {
      if (revokeList.length === 0) {
        return;
      }
      if (revokeList.length === 1) {
        return handleRevokeOne(revokeList[0]);
      }
      return handleRevoke(revokeList, dataSource);
    },
    [handleRevoke, handleRevokeOne],
  );

  return batchRevoke;
};
