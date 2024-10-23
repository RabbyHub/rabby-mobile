import { apisLock } from '@/core/apis';
import { PasswordStatus } from '@/core/apis/lock';
import { useLoadLockInfo } from '@/hooks/useLock';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

export type ManagePasswordViewType =
  | 'unknown'
  | 'manage-password'
  | 'setup-password'
  | 'password-setup'
  | 'change-password'
  | 'cancel-password';

const managePwdUIAtom = atom<{
  isShown: boolean;
  nextShownToLock: boolean;
  view: ManagePasswordViewType;
}>({
  isShown: false,
  nextShownToLock: false,
  view: 'unknown',
});

export function useManagePasswordUI() {
  const [
    { isShown: isShowManagePassword, nextShownToLock, view: managePwdView },
    setUIState,
  ] = useAtom(managePwdUIAtom);

  const setManagePwdView = useCallback(
    (view: ManagePasswordViewType) => {
      setUIState(state => ({ ...state, view }));
    },
    [setUIState],
  );

  const setIsShowManagePassword = useCallback(
    (isShown: boolean, shownToLock = false) => {
      setUIState(state => ({
        ...state,
        isShown,
        nextShownToLock: shownToLock,
      }));
    },
    [setUIState],
  );

  return {
    managePwdView,
    setManagePwdView,
    nextShownToLock,

    isShowManagePassword,
    setIsShowManagePassword,
  };
}

export function useWalletPasswordInfo(options?: { autoFetch?: boolean }) {
  const { isLoading, lockInfo, fetchLockInfo } = useLoadLockInfo();

  // /**
  //  * @deprecated not used now
  //  */
  // const setupPassword = useCallback(
  //   async (newPassword: string) => {
  //     const result = await apisLock.setupWalletPassword(newPassword);
  //     await fetchLockInfo();

  //     if (result.error) {
  //       throw new Error(result.error);
  //     }
  //   },
  //   [fetchLockInfo],
  // );

  const updatePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      const result = await apisLock.updateWalletPassword(
        oldPassword,
        newPassword,
      );
      await fetchLockInfo();

      if (result.error) {
        throw new Error(result.error);
      }
    },
    [fetchLockInfo],
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchLockInfo();
    }
  }, [options?.autoFetch, fetchLockInfo]);

  const hasSetupCustomPassword = lockInfo.pwdStatus === PasswordStatus.Custom;

  return {
    hasSetupCustomPassword,

    isLoading,
    lockInfo,
    fetchLockInfo,

    // setupPassword,
    updatePassword,
  };
}

export type SetupPasswordForm = {
  password: string;
  confirmPwd: string;
};
export type ChangePasswordForm = {
  currentPwd: string;
  newPwd: string;
  confirmPwd: string;
};
export type CancelPasswordForm = {
  currentPwd: string;
};

export type SubFormErrorStatics = {
  setupPwdForm: number;
  changePwdForm: number;
  cancelPwdForm: number;
};
const formErrorStatics = atom<SubFormErrorStatics>({
  setupPwdForm: 0,
  changePwdForm: 0,
  cancelPwdForm: 0,
});
export function useCollectSubForms<T extends keyof SubFormErrorStatics>(
  targetForm?: T,
) {
  const [formErrorCounts, setFormErrorCount] = useAtom(formErrorStatics);

  const collectErrorCountFor = useCallback(
    (formName: keyof SubFormErrorStatics, count: number) => {
      setFormErrorCount(state => ({ ...state, [formName]: count }));
    },
    [setFormErrorCount],
  );

  useEffect(() => {
    return () => {
      if (targetForm) {
        collectErrorCountFor(targetForm, 0);
      }
    };
  }, [collectErrorCountFor, targetForm]);

  return {
    formErrorCounts,
    collectErrorCountFor,
  };
}
