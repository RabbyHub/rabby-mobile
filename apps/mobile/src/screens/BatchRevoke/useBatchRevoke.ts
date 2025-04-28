import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
} from '../Approvals/useApprovalsPage';
import { apiApprovals } from '@/core/apis';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { findIndexRevokeList } from './utils';

export const useBatchRevoke = () => {
  const handleRevokeOne = React.useCallback(
    async (revokeList: ApprovalSpenderItemToBeRevoked[]) => {
      return apiApprovals
        .revoke({ list: revokeList })

        .catch(err => {
          console.log(err);
        });
    },
    [],
  );

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
        return handleRevokeOne(revokeList);
      }
      return handleRevoke(revokeList, dataSource);
    },
    [handleRevoke, handleRevokeOne],
  );

  return batchRevoke;
};
