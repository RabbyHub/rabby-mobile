import { addressUtils } from '@rabby-wallet/base-utils';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';

export type ContactBookItem = {
  /** @deprecated useless, migrated to AddressAliasItem.address. NEVER use it! */
  name: string;
  address: string;
};

export type AddressAliasItem = {
  address: string;
  alias: string;
  isDefaultAlias?: boolean;
};

export type ContactBookStore = {
  contacts: Record<string, ContactBookItem>;
  aliases: Record<string, AddressAliasItem>;
};

export class ContactBookService extends StoreServiceBase<ContactBookStore> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      'contactBook',
      {
        contacts: {},
        aliases: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  addContact(contact: ContactBookItem | ContactBookItem[]) {
    const contacts = Array.isArray(contact) ? contact : [contact];
    this.mutateStore(draft => {
      contacts.forEach(contact => {
        draft.contacts[contact.address.toLowerCase()] = contact;
      });
    });
  }

  listContacts(): ContactBookItem[] {
    return Object.values(this.store.contacts).map(contact => ({ ...contact }));
  }

  getContactByAddress(address: string) {
    const contact = this.store.contacts[address.toLowerCase()];
    if (!contact) {
      return undefined;
    }

    return { ...contact };
  }

  getContactsByMap() {
    return Object.fromEntries(
      Object.entries(this.store.contacts).map(([key, value]) => [
        key,
        { ...value },
      ]),
    );
  }

  setAlias(aliasItem: AddressAliasItem | AddressAliasItem[]) {
    const aliases = Array.isArray(aliasItem) ? aliasItem : [aliasItem];
    this.mutateStore(draft => {
      aliases.forEach(alias => {
        draft.aliases[alias.address.toLowerCase()] = alias;
      });
    });
  }

  listAlias() {
    return Object.values(this.store.aliases).map(alias => ({ ...alias }));
  }

  getAliasByAddress(
    address: string,
    options?: {
      /** @default false */
      keepEmptyIfNotFound?: boolean;
    },
  ): AddressAliasItem | undefined {
    if (!address) {
      return undefined;
    }
    const alias = this.store.aliases[address.toLowerCase()];
    if (!alias) {
      const { keepEmptyIfNotFound = false } = options || {};
      return {
        address: address.toLowerCase(),
        alias: keepEmptyIfNotFound ? '' : addressUtils.ellipsis(address, 6),
        isDefaultAlias: true,
      };
    }

    return { ...alias };
  }

  getAliasByMap() {
    return Object.fromEntries(
      Object.entries(this.store.aliases).map(([key, value]) => [
        key,
        { ...value },
      ]),
    );
  }

  updateAlias(data: { address: string; name: string }) {
    const key = data.address.toLowerCase();
    this.mutateStore(draft => {
      draft.aliases[key] = { alias: data.name, address: key };
    });
  }

  removeAlias = (address: string) => {
    const key = address.toLowerCase();
    if (!this.store.aliases[key]) {
      return;
    }
    this.mutateStore(draft => {
      if (draft.contacts[key]) {
        delete draft.contacts[key];
      } else {
        delete draft.aliases[key];
      }
    });
  };
}
