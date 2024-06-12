import { createPersistStore } from '@rabby-wallet/persist-store';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';

export type ContactBookItem = {
  /** @deprecated useless, migrated to AddressAliasItem.address. NEVER use it! */
  name: string;
  address: string;
};

export type AddressAliasItem = {
  address: string;
  alias: string;
};

export type ContactBookStore = {
  contacts: Record<string, ContactBookItem>;
  aliases: Record<string, AddressAliasItem>;
};

export class ContactBookService {
  private readonly store: ContactBookStore;

  constructor(options?: StorageAdapaterOptions) {
    this.store = createPersistStore<ContactBookStore>(
      {
        name: 'contactBook',
        template: {
          contacts: {},
          aliases: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
  }

  addContact(contact: ContactBookItem | ContactBookItem[]) {
    const contacts = Array.isArray(contact) ? contact : [contact];
    contacts.forEach(contact => {
      this.store.contacts = {
        ...this.store.contacts,
        [contact.address.toLocaleLowerCase()]: contact,
      };
    });
  }

  listContacts(): ContactBookItem[] {
    return Object.values(this.store.contacts);
  }

  getContactByAddress(address: string) {
    const contact = this.store.contacts[address.toLocaleLowerCase()];
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
        [alias.address.toLocaleLowerCase()]: alias,
      };
    });
  }

  listAlias() {
    return Object.values(this.store.aliases);
  }

  getAliasByAddress(address: string) {
    if (!address) {
      return undefined;
    }
    const alias = this.store.aliases[address.toLocaleLowerCase()];
    if (!alias) {
      return undefined;
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
}
