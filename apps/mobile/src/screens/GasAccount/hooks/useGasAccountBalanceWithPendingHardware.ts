import { usePendingHardwareAccount } from './atom';
import {
  useGasAccountInfo,
  useGasAccountInfoV2,
  useGasAccountLogin,
} from './index';

export const useGasAccountBalanceWithPendingHardware = () => {
  const { value, loading, runFetchGasAccountInfo } = useGasAccountInfo();
  const { isLogin } = useGasAccountLogin();
  const pendingHardwareAccount = usePendingHardwareAccount();
  const pendingHardwareAddress = !isLogin
    ? pendingHardwareAccount?.address
    : undefined;

  const {
    data: pendingHardwareGasAccountInfo,
    loading: pendingHardwareGasAccountLoading,
    refresh: refreshPendingHardwareGasAccountInfo,
  } = useGasAccountInfoV2({
    address: pendingHardwareAddress,
  });

  const displayAccountInfo = isLogin ? value : pendingHardwareGasAccountInfo;
  const displayBalance = Number(displayAccountInfo?.account?.balance || 0);
  const isDisplayBalanceLoading = isLogin
    ? !value && loading
    : !!pendingHardwareAddress &&
      !pendingHardwareGasAccountInfo?.account &&
      pendingHardwareGasAccountLoading;

  return {
    isLogin,
    gasAccount: value,
    runFetchGasAccountInfo,
    pendingHardwareAccount,
    pendingHardwareAddress,
    refreshPendingHardwareGasAccountInfo,
    displayBalance,
    isDisplayBalanceLoading,
  };
};
