import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
  useApprovalsPage,
} from '../Approvals/useApprovalsPage';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { findIndexRevokeList } from './utils';
import { useRevokeOne } from './useRevokeOne';
import { useApprovalAlertCounts } from '../Home/hooks/approvals';
import { useCurrentAccount } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { apiApprovals } from '@/core/apis';

export const useBatchRevoke = () => {
  const handleRevokeOne = useRevokeOne();
  const { forceUpdate } = useApprovalAlertCounts(10 * 60 * 1000);
  const { loadApprovals } = useApprovalsPage();
  const { currentAccount } = useCurrentAccount();

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
      naviPush(RootNames.StackTransaction, {
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
      // not support batch revoke
      if (
        currentAccount &&
        (currentAccount.type === KEYRING_TYPE.KeystoneKeyring ||
          currentAccount.type === KEYRING_TYPE.WatchAddressKeyring ||
          currentAccount.type === KEYRING_TYPE.GnosisKeyring)
      ) {
        forceUpdate();
        await apiApprovals.revoke({ list: revokeList });
        loadApprovals();
        return;
      }

      // only one item
      if (revokeList.length === 1) {
        forceUpdate();
        await handleRevokeOne(revokeList[0]);
        loadApprovals();
        return;
      }

      // batch revoke
      return handleRevoke(revokeList, dataSource);
    },
    [currentAccount, handleRevoke, forceUpdate, handleRevokeOne, loadApprovals],
  );

  return batchRevoke;
};
