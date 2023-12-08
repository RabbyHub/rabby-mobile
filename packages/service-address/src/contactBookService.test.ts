import * as sinon from 'sinon';
import { ContactBookService, ContactBookItem, AddressAliasItem } from './contactBookService';

describe('ContactBookService Service', () => {
  let service: ContactBookService;
  const TEST_ADDR = '0x39b97205b9826f21fd39b535cf972c809e160e5f';
  const TEST_ADDRS = [
    '0x39b97205b9826f21fd39b535cf972c809e160e5f',
    '0x39b97205b9826f21fd39b535cf972c809e160e5g',
  ];

  beforeEach(() => {
    service = new ContactBookService();
  });

  afterEach(() => {
    sinon.restore();
  });


  it('should create ContactBookService with empty contacts and aliases', () => {
    expect(service.listContacts()).toEqual([]);
    expect(service.listAlias()).toEqual([]);
  });

  it('should get contact by address', () => {
    const testContact: ContactBookItem = { name: 'Test Name', address: '0x123abc' };
    service.addContact(testContact);

    const result = service.getContactByAddress('0x123abc');
    expect(result).toEqual({ name: 'Test Name', address: '0x123abc' });
  });

  it('should return undefined when getting contact by non-existent address', () => {
    const result = service.getContactByAddress('0x999999');
    expect(result).toBeUndefined();
  });

  it('should list contacts', () => {
    const testContacts: ContactBookItem[] = [
      { name: 'Test Name 1', address: '0x123abc' },
      { name: 'Test Name 2', address: '0x456def' },
    ];

    service.addContact(testContacts);
    const result = service.listContacts();
    expect(result).toEqual(testContacts);
  });

  it('should list aliases', () => {
    const testAliases: AddressAliasItem[] = [
      { address: '0x123abc', alias: 'Alias 1' },
      { address: '0x456def', alias: 'Alias 2' },
    ];

    service.setAlias(testAliases);
    const result = service.listAlias();
    expect(result).toEqual(testAliases);
  });

  it('should get contacts by map', () => {
    const testContacts: ContactBookItem[] = [
      { name: 'Test Name 1', address: '0x123abc' },
      { name: 'Test Name 2', address: '0x456def' },
    ];

    service.addContact(testContacts);
    const result = service.getContactsByMap();
    const expectedMap = {
      '0x123abc': { name: 'Test Name 1', address: '0x123abc' },
      '0x456def': { name: 'Test Name 2', address: '0x456def' },
    };
    expect(result).toEqual(expectedMap);
  });

  it('should get aliases by map', () => {
    const testAliases: AddressAliasItem[] = [
      { address: '0x123abc', alias: 'Alias 1' },
      { address: '0x456def', alias: 'Alias 2' },
    ];

    service.setAlias(testAliases);
    const result = service.getAliasByMap();
    const expectedMap = {
      '0x123abc': { address: '0x123abc', alias: 'Alias 1' },
      '0x456def': { address: '0x456def', alias: 'Alias 2' },
    };
    expect(result).toEqual(expectedMap);
  });
});
