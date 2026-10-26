import type { ContactBookService } from '@rabby-wallet/service-address';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import { setDefaultAddressAlias } from '@/core/utils/addressAlias';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type ContactServiceApiContract = ContactBookService;
export const contactServiceApi = createDeferredServiceApi<
  'contactService',
  ContactServiceApiContract
>('contactService');

export function getContactAliasSnapshot(
  ...args: Parameters<ContactBookService['getAliasByAddress']>
) {
  const service = getRegisteredService('contactService');
  if (!service) {
    return undefined;
  }
  return service.getAliasByAddress(...args);
}

export function getContactAliasMapSnapshot() {
  const service = getRegisteredService('contactService');
  if (!service) {
    return {};
  }
  return service.getAliasByMap();
}

export function getContactsByMapSnapshot() {
  const service = getRegisteredService('contactService');
  if (!service) {
    return {};
  }
  return service.getContactsByMap();
}

export function updateContactAliasSync(
  ...args: Parameters<ContactBookService['updateAlias']>
) {
  const service = getRegisteredService('contactService');
  if (!service) {
    throw new Error('contactService is not ready');
  }
  service.updateAlias(...args);
}

export function setDefaultAddressAliasFromKeyringParamsSync(
  account: Parameters<typeof setDefaultAddressAlias>[0],
) {
  const service = getRegisteredService('contactService');
  setDefaultAddressAlias(account, service);
}
