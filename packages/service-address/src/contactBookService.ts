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
    super('contactBook', {
      contacts: {},
      aliases: {},
    },
    {
      storageAdapter: options?.storageAdapter,
    })
  }

  addContact(contact: ContactBookItem | ContactBookItem[]) {
    const contacts = Array.isArray(contact) ? contact : [contact];
    contacts.forEach(contact => {
      this.store.contacts = {
        ...this.store.contacts,
        [contact.address.toLowerCase()]: contact,
      };
    });
  }

  listContacts(): ContactBookItem[] {
    return Object.values(this.store.contacts);
  }

  getContactByAddress(address: string) {
    const contact = this.store.contacts[address.toLowerCase()];
    if (!contact) {
      return undefined;
    }

    return contact;
  }

  getContactsByMap() {
    return Object.assign({}, this.store.contacts);
  }

  setAlias(aliasItem: AddressAliasItem | AddressAliasItem[]) {
    const aliases = Array.isArray(aliasItem) ? aliasItem : [aliasItem];
    aliases.forEach(alias => {
      this.store.aliases = {
        ...this.store.aliases,
        [alias.address.toLowerCase()]: alias,
      };
    });
  }

  listAlias() {
    return Object.values(this.store.aliases);
  }

  getAliasByAddress(address: string, options?: {
    /** @default false */
    keepEmptyIfNotFound?: boolean;
  }): AddressAliasItem | undefined {
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

    return alias;
  }

  getAliasByMap() {
    return Object.assign({}, this.store.aliases);
  }

  updateAlias(data: { address: string; name: string }) {
    const key = data.address.toLowerCase();
    this.store.aliases = {
      ...this.store.aliases,
      [key]: { alias: data.name, address: key },
    };
  }

  removeAlias = (address: string) => {
    const key = address.toLowerCase();
    if (!this.store.aliases[key]) {
      return;
    }
    if (this.store.contacts[key]) {
      delete this.store.contacts[key];
    } else {
      delete this.store.aliases[key];
    }
  };
}
