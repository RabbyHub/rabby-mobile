import { CHAINS_ENUM } from '@debank/common';
import { ContactBookService } from '@rabby-wallet/service-address';
import axios from 'axios';
import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { setDefaultAddressAlias } from '@/core/utils/addressAlias';
import { migrateService } from '@/migrations/migrations';
import { ellipsis } from '@/utils/address';

// Construct the normal services with their normal persistence contracts.
/* eslint-disable no-runtime-service-imports */
import { CustomRPCService } from '../services/customRPCService';
import { SecurityEngineService } from '../services/securityEngine';
import { WhitelistService } from '../services/whitelist';
/* eslint-enable no-runtime-service-imports */
import { CONFIG_INTEGRITY_KEY, fieldInput } from './schema';
import { createFixture, sign, TEST_HMAC_KEY } from './testFixture';

const address = '0xaabbcc0000000000000000000000000000000001';
const second = '0x1122330000000000000000000000000000000002';
const rpc = APP_STORE_NAMES.rpc;
const contacts = APP_STORE_NAMES.contactBook;
const whitelist = APP_STORE_NAMES.whitelist;
const security = APP_STORE_NAMES.securityEngine;

function seedLegacy(f: ReturnType<typeof createFixture>) {
  f.storage.setItem(rpc, {
    customRPC: {
      [CHAINS_ENUM.ETH]: { enable: false },
      [CHAINS_ENUM.POLYGON]: {
        enable: true,
        url: 'https://rpc.example.invalid',
      },
      removed: { enable: true },
    },
  });
  f.storage.setItem(contacts, {
    aliases: { [address]: { address, alias: ellipsis(address, 4) } },
    contacts: {},
  });
  f.storage.setItem(whitelist, {
    enabled: false,
    whitelists: [address.toUpperCase().replace('0X', '0x'), second, address],
  });
  f.storage.setItem(security, {
    userData: { originBlacklist: [], originWhitelist: [] },
    rules: [],
  });
}

describe('configuration integrity with service persistence', () => {
  beforeEach(() => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { rpcs: [] } });
  });

  afterEach(() => {
    appStorage.removeItem(APP_MMKV_WEAK_KEYS.SERVICE_MIGRATIONS);
  });

  it('preserves four legacy formats and migration results while signing the actual records', async () => {
    const withIntegrity = createFixture();
    const withoutIntegrity = createFixture();
    seedLegacy(withIntegrity);
    seedLegacy(withoutIntegrity);

    const observer = await withIntegrity.start();
    expect(
      withIntegrity.storage.getItem(CONFIG_INTEGRITY_KEY).stores[rpc].customRPC,
    ).toBe(
      sign(
        TEST_HMAC_KEY,
        fieldInput(rpc, 'customRPC', withIntegrity.storage.getItem(rpc)),
      ),
    );

    for (const storageAdapter of [withoutIntegrity.storage, observer.storage]) {
      appStorage.removeItem(APP_MMKV_WEAK_KEYS.SERVICE_MIGRATIONS);
      const customRPC = new CustomRPCService({ storageAdapter });
      expect(customRPC.getRPCByChain(CHAINS_ENUM.ETH)).toEqual({
        enable: false,
      });
      expect(customRPC.getRPCByChain(CHAINS_ENUM.POLYGON).url).toBe(
        'https://rpc.example.invalid',
      );
      expect(customRPC.store.customRPC).not.toHaveProperty('removed');
      customRPC.flushStore();

      const contact = new ContactBookService({ storageAdapter });
      expect(migrateService(contacts, contact)?.successMigrationCount).toBe(1);
      expect(contact.getAliasByAddress(address)?.alias).toBe(ellipsis(address));
      contact.flushStore();

      const whitelistService = new WhitelistService({ storageAdapter });
      expect(
        migrateService(whitelist, whitelistService)?.successMigrationCount,
      ).toBe(1);
      expect(whitelistService.isWhitelistEnabled()).toBe(true);
      expect(whitelistService.getWhitelist()).toEqual([address, second]);
      whitelistService.flushStore();

      const engine = new SecurityEngineService({ storageAdapter });
      await engine.init();
      expect(engine.getUserData()).toMatchObject({
        addressBlacklist: [],
        contractWhitelist: [],
      });
      expect(engine.getRules().length).toBeGreaterThan(0);
      engine.flushStore();
    }

    for (const store of [rpc, contacts, whitelist, security]) {
      expect(withIntegrity.disk.get(store)).toBe(
        withoutIntegrity.disk.get(store),
      );
    }
    withIntegrity.events.length = 0;
    await withIntegrity.start();
    expect(withIntegrity.events).toEqual([]);
  });

  it('signs service edits, keyring aliases, and Testkit contact writes without dropping other signatures', async () => {
    const f = createFixture();
    const { storage: storageAdapter } = await f.start();
    const rpcService = new CustomRPCService({ storageAdapter });
    const contact = new ContactBookService({ storageAdapter });
    const whitelistService = new WhitelistService({ storageAdapter });
    const engine = new SecurityEngineService({ storageAdapter });
    await engine.init();
    rpcService.setRPC(CHAINS_ENUM.ETH, 'https://rpc.example.invalid');
    contact.addContact({ address, name: 'Testkit import' });
    setDefaultAddressAlias({ address }, contact);
    contact.updateAlias({ address: second, name: 'Testkit alias' });
    whitelistService.disableWhiteList();
    whitelistService.setWhitelist([address, second]);
    whitelistService.updateWhitelistOrder([second, address]);
    engine.addAddressBlacklist(address);
    engine.addOriginWhitelist('https://test.example.invalid');
    const [rule] = engine.getRules();
    if (rule.enable) {
      engine.disableRule(rule.id);
    } else {
      engine.enableRule(rule.id);
    }
    for (const service of [rpcService, contact, whitelistService, engine]) {
      service.flushStore();
    }

    const stored = f.storage.getItem(CONFIG_INTEGRITY_KEY);
    expect(Object.keys(stored.stores)).toHaveLength(4);
    expect(f.storage.getItem(contacts).aliases[address].alias).toBeTruthy();
    expect(f.storage.getItem(whitelist)).toMatchObject({
      enabled: false,
      whitelists: [{ address: second }, { address }],
    });
    expect(f.storage.getItem(security).userData.addressBlacklist).toEqual([
      address,
    ]);
    for (const [store, fields] of Object.entries(stored.stores)) {
      for (const [field, digest] of Object.entries(
        fields as Record<string, string>,
      )) {
        expect(digest).toBe(
          sign(
            TEST_HMAC_KEY,
            fieldInput(
              store as
                | typeof rpc
                | typeof contacts
                | typeof whitelist
                | typeof security,
              field,
              f.storage.getItem(store),
            ),
          ),
        );
      }
    }
    const previousMetadata = f.disk.get(CONFIG_INTEGRITY_KEY);
    rpcService.setDefaultRPCLastUpdateAt(42);
    rpcService.flushStore();
    expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(previousMetadata);

    f.events.length = 0;
    await f.start();
    expect(f.events).toEqual([]);
  });
});
