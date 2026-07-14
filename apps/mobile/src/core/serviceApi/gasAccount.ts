import type { GasAccountService } from '@/core/services/gasAccount';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  runServiceSideEffectWhenReady,
} from './createDeferredServiceApi';

export type GasAccountServiceApiContract = GasAccountService;
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

export async function getGasAccountData() {
  return (await gasAccountServiceApi.getGasAccountData()) as ReturnType<
    GasAccountService['getGasAccountData']
  >;
}

export async function getGasAccountLastDepositAccount() {
  return (await gasAccountServiceApi.getLastDepositAccount()) as ReturnType<
    GasAccountService['getLastDepositAccount']
  >;
}

export function setGasAccountSigSync(
  ...args: Parameters<GasAccountService['setGasAccountSig']>
) {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.setGasAccountSig(...args),
    'gasAccountService.setGasAccountSig',
  );
}

export function setGasAccountCurrentBalanceStateSync(
  ...args: Parameters<GasAccountService['setCurrentBalanceState']>
) {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.setCurrentBalanceState(...args),
    'gasAccountService.setCurrentBalanceState',
  );
}

export function setGasAccountAccountsWithBalanceSync(
  ...args: Parameters<GasAccountService['setAccountsWithGasAccountBalance']>
) {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.setAccountsWithGasAccountBalance(...args),
    'gasAccountService.setAccountsWithGasAccountBalance',
  );
}

export function setGasAccountPendingHardwareAccountSync(
  ...args: Parameters<GasAccountService['setPendingHardwareAccount']>
) {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.setPendingHardwareAccount(...args),
    'gasAccountService.setPendingHardwareAccount',
  );
}

export function clearGasAccountPendingHardwareAccountSync() {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.clearPendingHardwareAccount(),
    'gasAccountService.clearPendingHardwareAccount',
  );
}

export function setGasAccountHasClaimedGiftSync(
  ...args: Parameters<GasAccountService['setHasClaimedGift']>
) {
  runServiceSideEffectWhenReady(
    'gasAccountService',
    service => service.setHasClaimedGift(...args),
    'gasAccountService.setHasClaimedGift',
  );
}

export function getGasAccountCurrentEligibleAddressSnapshot() {
  return getRegisteredService('gasAccountService')?.getCurrentEligibleAddress();
}

export function getGasAccountAccountsWithBalanceSnapshot() {
  return (
    getRegisteredService(
      'gasAccountService',
    )?.getAccountsWithGasAccountBalance() || []
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

export async function markGasAccountLoggedIn() {
  return gasAccountServiceApi.markLoggedIn();
}

export async function setGasAccountLastDepositAccount(
  ...args: Parameters<GasAccountService['setLastDepositAccount']>
) {
  await gasAccountServiceApi.setLastDepositAccount(...args);
}
