import type {
  DappInfo,
  DappService,
  DappStore,
} from '@/core/services/dappService';
import type { FieldNilable } from '@rabby-wallet/base-utils';
import {
  getRegisteredService,
  isCoreServiceLoaded,
  requireCoreService,
  waitForCoreService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  ensureServiceApiReady,
} from './createDeferredServiceApi';

export type DappServiceApiContract = DappService;
export const dappServiceApi = createDeferredServiceApi<
  'dappService',
  DappServiceApiContract
>('dappService');

const EMPTY_DAPPS: Record<string, DappInfo> = {};

export function ensureDappServiceReady() {
  return ensureServiceApiReady('dappService');
}

export function isDappServiceReady() {
  return isCoreServiceLoaded('dappService');
}

function requireDappService() {
  return requireCoreService('dappService');
}

export function getDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.getDapp(origin);
}

export function addDappSync(...args: Parameters<DappService['addDapp']>) {
  requireDappService().addDapp(...args);
}

export function removeDappSync(...args: Parameters<DappService['removeDapp']>) {
  requireDappService().removeDapp(...args);
}

export function updateDappSync(...args: Parameters<DappService['updateDapp']>) {
  requireDappService().updateDapp(...args);
}

export function patchDappsSync(...args: Parameters<DappService['patchDapps']>) {
  requireDappService().patchDapps(...args);
}

export function disconnectDappSync(
  ...args: Parameters<DappService['disconnect']>
) {
  requireDappService().disconnect(...args);
}

export function getDappsSnapshot() {
  return getRegisteredService('dappService')?.getDapps() || EMPTY_DAPPS;
}

export function getDappStoreSnapshot(): DappStore {
  return {
    dapps: getDappsSnapshot(),
  };
}

export function getConnectedDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.getConnectedDapp(origin) || null;
}

export function hasDappPermissionSnapshot(origin: string) {
  return getRegisteredService('dappService')?.hasPermission(origin) || false;
}

export function isInternalDappSnapshot(origin: string) {
  return getRegisteredService('dappService')?.isInternalDapp(origin) || false;
}

export async function bindDappStoreListener(
  listener: <K extends keyof DappStore>(
    key: K,
    value: FieldNilable<DappStore>[K],
  ) => void,
) {
  const service = await waitForCoreService('dappService');
  listener('dapps', service.getStoreFieldSnapshot('dapps'));
  return service.subscribeStoreFields(listener);
}
