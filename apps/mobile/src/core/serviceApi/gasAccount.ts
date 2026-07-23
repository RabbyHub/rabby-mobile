import type { GasAccountService } from '@/core/services/gasAccount';
import {
  getRegisteredService,
  requireCoreService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  ensureServiceApiReady,
} from './createDeferredServiceApi';

export type GasAccountServiceApiContract = GasAccountService;
export const gasAccountServiceApi = createDeferredServiceApi<
  'gasAccountService',
  GasAccountServiceApiContract
>('gasAccountService');

let observedGasAccountService: GasAccountService | undefined;
let gasAccountServiceGeneration = 0;

export function getGasAccountServiceGenerationSnapshot(
  expectedService?: GasAccountService,
) {
  const service = getRegisteredService('gasAccountService');
  if (service !== observedGasAccountService) {
    observedGasAccountService = service;
    gasAccountServiceGeneration += 1;
  }

  if (!service || (expectedService && service !== expectedService)) {
    return undefined;
  }

  return gasAccountServiceGeneration;
}

export async function ensureGasAccountServiceReady() {
  await ensureServiceApiReady('gasAccountService');
  const generation = getGasAccountServiceGenerationSnapshot();
  if (generation === undefined) {
    throw new Error('Gas Account service is ready but not registered');
  }
  return generation;
}

function requireGasAccountService() {
  return requireCoreService('gasAccountService');
}

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
  requireGasAccountService().setGasAccountSig(...args);
}

export function setGasAccountCurrentBalanceStateSync(
  ...args: Parameters<GasAccountService['setCurrentBalanceState']>
) {
  requireGasAccountService().setCurrentBalanceState(...args);
}

export function setGasAccountAccountsWithBalanceSync(
  ...args: Parameters<GasAccountService['setAccountsWithGasAccountBalance']>
) {
  requireGasAccountService().setAccountsWithGasAccountBalance(...args);
}

export function setGasAccountPendingHardwareAccountSync(
  ...args: Parameters<GasAccountService['setPendingHardwareAccount']>
) {
  requireGasAccountService().setPendingHardwareAccount(...args);
}

export function clearGasAccountPendingHardwareAccountSync() {
  requireGasAccountService().clearPendingHardwareAccount();
}

export function setGasAccountHasClaimedGiftSync(
  ...args: Parameters<GasAccountService['setHasClaimedGift']>
) {
  requireGasAccountService().setHasClaimedGift(...args);
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
