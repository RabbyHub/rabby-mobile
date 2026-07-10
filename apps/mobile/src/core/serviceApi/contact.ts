import type { ContactBookService } from '@rabby-wallet/service-address';
import type { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import { onSetAddressAlias } from '@/core/services/keyringParams';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type ContactServiceApiContract = ContactBookService;

registerLegacyCoreServiceLoader('contactService');

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

export function setDefaultAddressAliasFromKeyringParamsSync(
  account: Parameters<
    NonNullable<KeyringServiceOptions['onSetAddressAlias']>
  >[1],
) {
  const service = getRegisteredService('contactService');
  void onSetAddressAlias(undefined, account, service);
}
