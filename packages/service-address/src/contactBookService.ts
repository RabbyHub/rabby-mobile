import { createPersistStore } from '@rabby-wallet/persist-store';

export interface ContactBookItem {
  name: string;
  address: string;
}

export interface AddressAliasItem {
  address: string;
  alias: string;
}

export type ContactBookStore = {
  contacts: Record<string, ContactBookItem>;
  aliases: Record<string, AddressAliasItem>;
};

export class ContactBookService {
  private store: ContactBookStore;

  constructor() {
    this.store = createPersistStore<ContactBookStore>({
      name: 'contactBook',
      template: {
        contacts: {},
        aliases: {},
      },
    });
  }

  addContact (contact: ContactBookItem | ContactBookItem[]) {
    const contacts = Array.isArray(contact) ? contact : [contact];
    contacts.forEach(contact => {
      this.store.contacts[contact.address] = contact;
    })
  }

  listContacts (): ContactBookItem[] {
    return Object.values(this.store.contacts);
  };

  getContactByAddress (address: string) {
    const contact = this.store.contacts[address.toLocaleLowerCase()];
    if (!contact) return undefined;

    return contact;
  };

  getContactsByMap () {
    return Object.assign({}, this.store.contacts);
  };

  setAlias(aliasItem: AddressAliasItem | AddressAliasItem[]) {
    const aliases = Array.isArray(aliasItem) ? aliasItem : [aliasItem];
    aliases.forEach(alias => {
      this.store.aliases[alias.address] = alias;
    })
  }

  listAlias () {
    return Object.values(this.store.aliases);
  };

  getAliasByAddress (address: string) {
    const alias = this.store.aliases[address.toLocaleLowerCase()];
    if (!alias) return undefined;

    return alias;
  }

  getAliasByMap () {
    return Object.assign({}, this.store.aliases);
  };
}
