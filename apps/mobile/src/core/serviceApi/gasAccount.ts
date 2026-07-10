import type { GasAccountService } from '@/core/services/gasAccount';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type GasAccountServiceApiContract = GasAccountService;

registerLegacyCoreServiceLoader('gasAccountService');

export const gasAccountServiceApi = createDeferredServiceApi<
  'gasAccountService',
  GasAccountServiceApiContract
>('gasAccountService');

export function getGasAccountSigSnapshot() {
  return (
    getRegisteredService('gasAccountService')?.getGasAccountSig() || {
      sig: undefined,
      accountId: undefined,
    }
  );
}

export function getGasAccountPendingHardwareAccountSnapshot() {
  return getRegisteredService('gasAccountService')?.getPendingHardwareAccount();
}

export function getGasAccountHasClaimedGiftSnapshot() {
  return (
    getRegisteredService('gasAccountService')?.getHasClaimedGift() || false
  );
}

export function getGasAccountDataSnapshot() {
  return getRegisteredService('gasAccountService')?.getGasAccountData() || {};
}

export function setGasAccountSigSync(
  ...args: Parameters<GasAccountService['setGasAccountSig']>
) {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.setGasAccountSig(...args);
}

export function setGasAccountCurrentBalanceStateSync(
  ...args: Parameters<GasAccountService['setCurrentBalanceState']>
) {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.setCurrentBalanceState(...args);
}

export function setGasAccountAccountsWithBalanceSync(
  ...args: Parameters<GasAccountService['setAccountsWithGasAccountBalance']>
) {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.setAccountsWithGasAccountBalance(...args);
}

export function setGasAccountPendingHardwareAccountSync(
  ...args: Parameters<GasAccountService['setPendingHardwareAccount']>
) {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.setPendingHardwareAccount(...args);
}

export function clearGasAccountPendingHardwareAccountSync() {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.clearPendingHardwareAccount();
}

export function setGasAccountHasClaimedGiftSync(
  ...args: Parameters<GasAccountService['setHasClaimedGift']>
) {
  const service = getRegisteredService('gasAccountService');
  if (!service) {
    throw new Error('gasAccountService is not ready');
  }
  service.setHasClaimedGift(...args);
}

export function getGasAccountCurrentEligibleAddressSnapshot() {
  return getRegisteredService('gasAccountService')?.getCurrentEligibleAddress();
}

export function getGasAccountAccountsWithBalanceSnapshot() {
  return (
    getRegisteredService('gasAccountService')?.getAccountsWithGasAccountBalance() ||
    []
  );
}

export function getGasAccountCurrentBalanceStateSnapshot() {
  return (
    getRegisteredService('gasAccountService')?.getCurrentBalanceState() || {
      accountId: undefined,
      hasBalance: undefined,
    }
  );
}

export function hasGasAccountTrackedGa4ActiveTodaySnapshot() {
  return (
    getRegisteredService('gasAccountService')?.hasTrackedGa4ActiveToday() ||
    false
  );
}

export function markGasAccountLoggedInSnapshot() {
  return getRegisteredService('gasAccountService')?.markLoggedIn() || false;
}

export async function setGasAccountLastDepositAccount(
  ...args: Parameters<GasAccountService['setLastDepositAccount']>
) {
  await gasAccountServiceApi.setLastDepositAccount(...args);
}
