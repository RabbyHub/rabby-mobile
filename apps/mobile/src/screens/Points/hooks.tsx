import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/sendRequest';
import { openapi } from '@/core/request';
import { preferenceService, rabbyPointsService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { useCallback } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';

export const useRabbyPoints = () => {
  const { currentAccount: account } = useCurrentAccount();

  const {
    value: signature,
    loading: signatureLoading,
    retry: refreshSignature,
  } = useAsyncRetry(async () => {
    if (account?.address) {
      const data = await rabbyPointsService.getSignature(account?.address);
      return data;
    }
    return;
  }, [account?.address]);

  const {
    value: snapshot,
    loading: snapshotLoading,
    retry: refreshSnapshot,
  } = useAsyncRetry(async () => {
    if (account?.address) {
      const data = await openapi.getRabbyPointsSnapshot({
        id: account?.address,
      });
      return data;
    }
    return;
  }, [account?.address]);

  const {
    value: userPointsDetail,
    loading: userLoading,
    retry: refreshUserPoints,
  } = useAsyncRetry(async () => {
    if (account?.address) {
      const data = await openapi.getRabbyPoints({
        id: account?.address,
      });
      return data;
    }
    return undefined;
  }, [account?.address]);

  const {
    value: topUsers,
    loading: topUsersLoading,
    retry: refreshActivities,
  } = useAsyncRetry(async () => {
    if (account?.address) {
      const data = await openapi.getRabbyPointsTopUsers({
        id: account?.address,
      });
      return data;
    }
    return undefined;
  }, [account?.address]);

  const {
    value: activities,
    loading: activitiesLoading,
    retry: refreshTopUsers,
  } = useAsyncRetry(async () => {
    if (account?.address) {
      const data = await openapi.getRabbyPointsList({
        id: account?.address,
      });
      return data;
    }
    return undefined;
  }, [account?.address]);

  const refreshAll = useCallback(() => {
    refreshSignature();
    refreshSnapshot();
    refreshUserPoints();
    refreshActivities();
    refreshTopUsers();
  }, [
    refreshSignature,
    refreshSnapshot,
    refreshUserPoints,
    refreshActivities,
    refreshTopUsers,
  ]);

  const verifyAddress = useCallback(
    async (...arg: Parameters<typeof rabbyPointVerifyAddress>) => {
      await rabbyPointVerifyAddress(...arg);
      refreshAll();
    },
    [refreshAll],
  );

  return {
    signature,
    signatureLoading,
    snapshot,
    snapshotLoading,
    userPointsDetail,
    userLoading,
    topUsers,
    topUsersLoading,
    activities,
    activitiesLoading,
    refreshSignature,
    refreshSnapshot,
    refreshUserPoints,
    refreshActivities,
    refreshTopUsers,
    refreshAll,
    verifyAddress,
  };
};

export const useRabbyPointsInvitedCodeCheck = (invitedCode?: string) => {
  const { currentAccount: account } = useCurrentAccount();

  const { value: codeStatus, loading: codeLoading } = useAsync(async () => {
    if (invitedCode && account?.address) {
      const data = await openapi.checkRabbyPointsInviteCode({
        code: invitedCode,
      });
      return data;
    }
    return;
  }, [invitedCode, account?.address]);
  return {
    codeStatus,
    codeLoading,
  };
};

const rabbyPointVerifyAddress = async (params?: {
  code?: string;
  claimSnapshot?: boolean;
  claimNumber?: number;
}) => {
  const { code, claimSnapshot } = params || {};
  const account = await preferenceService.getCurrentAccount();
  if (!account) throw new Error('background.error.noCurrentAccount');
  const claimText = `${account?.address} Claims Rabby Points`;
  const verifyAddr = `Rabby Wallet wants you to sign in with your address:\n${account?.address}`;
  const msg = `0x${Buffer.from(
    claimSnapshot ? claimText : verifyAddr,
    'utf-8',
  ).toString('hex')}`;

  const signature = await sendRequest<string>(
    {
      method: 'personal_sign',
      params: [msg, account.address],
    },
    INTERNAL_REQUEST_SESSION,
  );

  rabbyPointsService.setSignature(account.address, signature);
  if (claimSnapshot) {
    try {
      await openapi.claimRabbyPointsSnapshot({
        id: account?.address,
        invite_code: code,
        signature,
      });
    } catch (error) {
      console.error(error);
    }
  }
  return signature;
};
