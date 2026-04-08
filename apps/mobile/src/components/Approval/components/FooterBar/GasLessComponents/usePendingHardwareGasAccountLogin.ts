import { toast } from '@/components2024/Toast';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import {
  useGasAccountInfoV2,
  useGasAccountLogin,
  useGasAccountMethods,
} from '@/screens/GasAccount/hooks';
import { usePendingHardwareAccount } from '@/screens/GasAccount/hooks/atom';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { BRAND_ALIAS_TYPE_TEXT } from '@rabby-wallet/keyring-utils';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getHardwareBrandLabel = (brandName?: string) => {
  if (!brandName) {
    return '';
  }
  return (
    BRAND_ALIAS_TYPE_TEXT[brandName as keyof typeof BRAND_ALIAS_TYPE_TEXT] ||
    brandName
  );
};

export const usePendingHardwareGasAccountLogin = ({
  enabled = false,
  gasAccountCost,
  currentGasAccountAddress,
  onLoggedIn,
}: {
  enabled?: boolean;
  gasAccountCost?: GasAccountCheckResult;
  currentGasAccountAddress?: string;
  onLoggedIn?: () => void;
}) => {
  const { t } = useTranslation();
  const { isLogin } = useGasAccountLogin();
  const { login } = useGasAccountMethods();
  const pendingHardwareAccount = usePendingHardwareAccount();
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const [isLoggingPendingHardware, setIsLoggingPendingHardware] =
    useState(false);

  const pendingHardwareLoginAccount = useMemo(
    () =>
      pendingHardwareAccount?.address
        ? accounts.find(item =>
            isSameAddress(item.address, pendingHardwareAccount.address),
          )
        : undefined,
    [accounts, pendingHardwareAccount?.address],
  );
  const pendingHardwareAddress = pendingHardwareLoginAccount?.address;
  const { data: pendingHardwareGasAccountInfo } = useGasAccountInfoV2({
    address: pendingHardwareAddress,
  });
  const pendingHardwareBalance = new BigNumber(
    pendingHardwareGasAccountInfo?.account?.balance || 0,
  );
  const requiredTotalCost = new BigNumber(
    gasAccountCost?.gas_account_cost?.total_cost || 0,
  );

  const isInsufficientOnly = useMemo(() => {
    if (!gasAccountCost || gasAccountCost.chain_not_support) {
      return false;
    }
    const isInsufficientError =
      gasAccountCost.err_msg?.toLowerCase() ===
      GAS_ACCOUNT_INSUFFICIENT_TIP.toLowerCase();
    const hasOtherError = !!gasAccountCost.err_msg && !isInsufficientError;
    return (
      !hasOtherError &&
      (!gasAccountCost.balance_is_enough || isInsufficientError)
    );
  }, [gasAccountCost]);

  const isAddressMismatch =
    !!pendingHardwareAddress &&
    !!currentGasAccountAddress &&
    !isSameAddress(pendingHardwareAddress, currentGasAccountAddress);

  const hasEnoughPendingHardwareBalance =
    requiredTotalCost.isFinite() &&
    requiredTotalCost.gt(0) &&
    pendingHardwareBalance.gte(requiredTotalCost);

  const shouldSignWithPendingHardware =
    enabled &&
    !isLogin &&
    !!pendingHardwareAddress &&
    isInsufficientOnly &&
    isAddressMismatch &&
    hasEnoughPendingHardwareBalance;
  const pendingHardwareBrandLabel = getHardwareBrandLabel(
    pendingHardwareLoginAccount?.brandName,
  );

  const handleSignWithPendingHardware = useCallback(async () => {
    if (
      !shouldSignWithPendingHardware ||
      !pendingHardwareLoginAccount ||
      isLoggingPendingHardware
    ) {
      return false;
    }

    setIsLoggingPendingHardware(true);
    try {
      await login(pendingHardwareLoginAccount as Account);
      toast.success(t('page.gasAccount.loginSuccess'));
      onLoggedIn?.();
      return true;
    } catch (error) {
      console.error('login pending hardware gas account error', error);
      toast.error(t('page.gasAccount.loginFailed'));
      return false;
    } finally {
      setIsLoggingPendingHardware(false);
    }
  }, [
    isLoggingPendingHardware,
    login,
    onLoggedIn,
    pendingHardwareLoginAccount,
    shouldSignWithPendingHardware,
    t,
  ]);

  return {
    shouldSignWithPendingHardware,
    pendingHardwareBrandLabel,
    isLoggingPendingHardware,
    handleSignWithPendingHardware,
  };
};
