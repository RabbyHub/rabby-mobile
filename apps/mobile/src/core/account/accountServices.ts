import type { ContactBookService } from '@rabby-wallet/service-address';
import type KeyringService from '@rabby-wallet/service-keyring';

import type { PreferenceService } from '@/core/services/preference';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';

type ContactServiceLike = Pick<
  ContactBookService,
  'getAliasByAddress' | 'getAliasByMap'
>;

type KeyringServiceLike = Pick<
  KeyringService,
  | 'getAllTypedVisibleAccounts'
  | 'getAllVisibleAccountsArray'
  | 'getCountOfAccountsInKeyring'
  | 'getKeyringForAccount'
>;

type PreferenceServiceLike = Pick<PreferenceService, 'getPinAddresses'>;

export const getContactService = () =>
  getServiceReady<ContactServiceLike>(SERVICE_READY_KEYS.contactService);

export const getKeyringService = () =>
  getServiceReady<KeyringServiceLike>(SERVICE_READY_KEYS.keyringService);

export const getPreferenceService = () =>
  getServiceReady<PreferenceServiceLike>(SERVICE_READY_KEYS.preferenceService);
