import { ContactBookItem } from '@rabby-wallet/service-address';
import { contactService } from '../services';

export interface UIContactBookItem {
  name: string;
  address: string;
}

export function getAliasName(
  ...[address, opts]: Parameters<typeof contactService.getAliasByAddress>
) {
  const aliasItem = contactService.getAliasByAddress(address, opts);

  return aliasItem?.alias || undefined;
}

export function getContactsByAddress(): Record<string, ContactBookItem> {
  const contactsByAddr = contactService.getContactsByMap();

  Object.values(contactsByAddr).forEach(item => {
    if (item) {
      item.address = item.address?.toLowerCase() || '';
    }
  });

  return contactsByAddr;
}

// /**
//  * @deprecated just for migration convenience, use contactService.getAliasByMap
//  */
// export function getAllAlianNameByMap(): Record<
//   string,
//   AddressAliasItem
// > {
//   return contactService.listAlias().reduce((res, item) => {
//     if (!item.address) return res;
//     return {
//       ...res,
//       [item.address]: item,
//     };
//   }, {} as Record<
//     string,
//     AddressAliasItem
//   >);
// };
