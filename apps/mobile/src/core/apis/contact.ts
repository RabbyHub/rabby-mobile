import {
  AddressAliasItem,
  ContactBookItem,
} from '@rabby-wallet/service-address';
import { contactService } from '../services';

export interface UIContactBookItem {
  name: string;
  address: string;
}

export function getAliasName(address: string) {
  const contact = contactService.getContactByAddress(address);

  return contact?.name || undefined;
}

/** @deprected just for migration convenience, use `getAliasName` directly! */
export const getAlianName = getAliasName;

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
