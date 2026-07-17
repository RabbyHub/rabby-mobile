import type { ContactBookService } from '@rabby-wallet/service-address';
import type { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';

import { ellipsisAddress } from '@/utils/address';

type KeyringAccount = Parameters<
  NonNullable<KeyringServiceOptions['onSetAddressAlias']>
>[1];

export function setDefaultAddressAlias(
  account: KeyringAccount,
  contactService?: ContactBookService,
) {
  if (!contactService) {
    if (__DEV__) {
      console.warn('contactService is not provided, skip setting alias');
    }
    return;
  }

  const existingAlias = contactService.getAliasByAddress(account.address);
  contactService.setAlias({
    address: account.address,
    alias: existingAlias?.alias || ellipsisAddress(account.address),
  });
}
