import { apisLock } from '@/core/apis';
import { PasswordStatus, RabbyMobileLockInfo } from '@/core/apis/lock';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

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

const lockInfoAtom = atom<RabbyMobileLockInfo>({
  pwdStatus: PasswordStatus.Unknown,
});

export function useWalletLockInfo(options?: { autoFetch?: boolean }) {
  const [lockInfo, setLockInfo] = useAtom(lockInfoAtom);
  const isLoadingRef = useRef(false);

  const fetchLockInfo = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const response = await apisLock.getRabbyLockInfo();

      setLockInfo({
        pwdStatus: response.pwdStatus,
      });
    } catch (error) {
      console.error(error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [setLockInfo]);

  const setupPassword = useCallback(
    async (newPassword: string) => {
      const result = await apisLock.setupWalletPassword(newPassword);
      await fetchLockInfo();

      if (result.error) {
        throw new Error(result.error);
      }
    },
    [fetchLockInfo],
  );

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

  const cancelPassword = useCallback(
    async (oldPassword: string) => {
      const result = await apisLock.cancelCustomPassword(oldPassword);
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

  return {
    isLoading: isLoadingRef.current,
    lockInfo,
    fetchLockInfo,

    setupPassword,
    updatePassword,
    cancelPassword,
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
