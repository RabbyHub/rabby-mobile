import { APP_STORE_NAMES } from '../storage/storeConstant';
import {
  CONFIG_INTEGRITY_KEY,
  fieldInput,
  registry,
  type Registry,
} from './schema';
import { createFixture, sign, TEST_HMAC_KEY } from './testFixture';

const rpc = APP_STORE_NAMES.rpc;
const contacts = APP_STORE_NAMES.contactBook;
const whitelist = APP_STORE_NAMES.whitelist;
const security = APP_STORE_NAMES.securityEngine;

describe('configuration integrity input', () => {
  it('sorts nested keys, separates fields and stores, and preserves presence, case and array order', () => {
    const input = (value: unknown) =>
      fieldInput(rpc, 'customRPC', { customRPC: value });
    const data = { z: [1, 'Value'], a: { 2: 'two', 10: 'ten' } };
    expect(input(data)).toBe(
      '[1,"rpc","customRPC",true,{"a":{"10":"ten","2":"two"},"z":[1,"Value"]}]',
    );
    expect(input({ a: { 10: 'ten', 2: 'two' }, z: [1, 'Value'] })).toBe(
      input(data),
    );
    expect(input({ ...data, z: [1, 'value'] })).not.toBe(input(data));
    expect(input({ ...data, z: ['Value', 1] })).not.toBe(input(data));
    expect(input(null)).not.toBe(fieldInput(rpc, 'customRPC', {}));
    expect(input({})).not.toBe(
      fieldInput(contacts, 'customRPC', { customRPC: {} }),
    );
    expect(input({})).not.toBe(fieldInput(rpc, 'calls', { calls: {} }));
  });
});

describe('configuration integrity coordinator', () => {
  it('builds one baseline from all saved records without writing business records or loading services', async () => {
    const f = createFixture();
    f.disk.set(
      rpc,
      ' { "customRPC" : {"ETH":{"enable":true}}, "defaultRPC":{} } ',
    );
    f.disk.set(contacts, '{}');
    f.disk.set(whitelist, '{"enabled":null,"whitelists":[]}');
    f.disk.set(security, '{"userData":{},"rules":[]}');
    const original = [...f.disk];
    const observer = f.process();
    const scan = observer.start(f.runtime);
    expect(observer.start(f.runtime)).toBe(scan);
    await scan;
    expect(f.events).toEqual([
      'keychain:create',
      CONFIG_INTEGRITY_KEY,
      'keychain:update',
    ]);
    expect([...f.disk].slice(0, 4)).toEqual(original);
    expect(f.getKey()).toEqual({
      key: TEST_HMAC_KEY,
      baselineRegistryVersion: 1,
    });
    expect(f.storage.getItem(CONFIG_INTEGRITY_KEY)).toEqual({
      version: 1,
      algorithm: 'HMAC-SHA256',
      stores: {
        [rpc]: {
          customRPC: sign(
            TEST_HMAC_KEY,
            '[1,"rpc","customRPC",true,{"ETH":{"enable":true}}]',
          ),
        },
        [contacts]: {
          aliases: sign(TEST_HMAC_KEY, '[1,"contactBook","aliases",false]'),
          contacts: sign(TEST_HMAC_KEY, '[1,"contactBook","contacts",false]'),
        },
        [whitelist]: {
          enabled: expect.stringMatching(/^[a-f0-9]{64}$/),
          whitelists: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        [security]: {
          userData: expect.stringMatching(/^[a-f0-9]{64}$/),
          rules: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    });
  });

  it.each(['metadata', 'keychain'] as const)(
    'resumes after failure writing %s during initial baseline',
    async failure => {
      const f = createFixture();
      f.disk.set(rpc, '{"customRPC":{}}');
      if (failure === 'metadata') {
        f.failWritesFor(CONFIG_INTEGRITY_KEY);
      } else {
        f.keychain.update.mockRejectedValueOnce(new Error('unavailable'));
      }
      await f.start();
      expect(f.getKey()).toEqual({
        key: TEST_HMAC_KEY,
        baselineRegistryVersion: 0,
      });
      expect(f.diagnostics()).toEqual([
        failure === 'metadata'
          ? { reason: 'metadata_write_failed', store: rpc, field: 'customRPC' }
          : { reason: 'key_init_failed' },
      ]);
      f.events.length = 0;
      f.failWritesFor();
      await f.start();
      expect(f.keychain.create).toHaveBeenCalledTimes(1);
      expect(f.events).toEqual(
        failure === 'metadata'
          ? [CONFIG_INTEGRITY_KEY, 'keychain:update']
          : ['keychain:update'],
      );
      expect(f.getKey()).toEqual({
        key: TEST_HMAC_KEY,
        baselineRegistryVersion: 1,
      });
    },
  );

  it.each(['all', 'store'] as const)(
    'reports missing %s metadata before rebuilding while skipping a missing business record',
    async scope => {
      const f = createFixture();
      f.disk.set(contacts, '{}');
      f.disk.set(rpc, '{}');
      await f.start();
      const previous = f.storage.getItem(CONFIG_INTEGRITY_KEY);
      if (scope === 'all') {
        f.disk.delete(CONFIG_INTEGRITY_KEY);
        f.disk.delete(rpc);
      } else {
        delete previous.stores[contacts];
        f.disk.set(CONFIG_INTEGRITY_KEY, JSON.stringify(previous));
      }
      f.events.length = 0;
      await f.start();
      expect(f.events).toEqual([
        scope === 'all'
          ? { reason: 'metadata_missing' }
          : { reason: 'metadata_missing', store: contacts },
        CONFIG_INTEGRITY_KEY,
      ]);
      expect(
        Object.keys(f.storage.getItem(CONFIG_INTEGRITY_KEY).stores).sort(),
      ).toEqual(scope === 'all' ? [contacts] : [contacts, rpc]);
    },
  );

  it('checks the whole missing-metadata event only once when several business records already exist', async () => {
    const f = createFixture();
    f.disk.set(contacts, '{}');
    f.disk.set(rpc, '{}');
    await f.start();
    f.disk.delete(CONFIG_INTEGRITY_KEY);
    f.events.length = 0;
    await f.start();
    expect(f.events).toEqual([
      { reason: 'metadata_missing' },
      CONFIG_INTEGRITY_KEY,
    ]);
    expect(
      Object.keys(f.storage.getItem(CONFIG_INTEGRITY_KEY).stores),
    ).toHaveLength(2);
  });

  it('leaves invalid portions unchanged while repairing a mismatch in another store', async () => {
    const f = createFixture();
    f.disk.set(contacts, '{}');
    f.disk.set(rpc, '{}');
    f.disk.set(whitelist, '{}');
    f.disk.set(security, '{}');
    await f.start();
    const metadata = f.storage.getItem(CONFIG_INTEGRITY_KEY);
    metadata.stores[contacts].contacts = 'invalid';
    delete metadata.stores[contacts].aliases;
    metadata.stores[whitelist] = null;
    f.disk.set(CONFIG_INTEGRITY_KEY, JSON.stringify(metadata));
    f.disk.set(rpc, '{"customRPC":null}');
    f.disk.set(security, '[]');

    f.events.length = 0;
    await f.start();
    expect(f.events).toEqual([
      { reason: 'hmac_mismatch', store: rpc, field: 'customRPC' },
      { reason: 'metadata_invalid', store: contacts, field: 'contacts' },
      { reason: 'metadata_invalid', store: contacts, field: 'aliases' },
      { reason: 'metadata_invalid', store: whitelist },
      { reason: 'config_unreadable', store: security },
      CONFIG_INTEGRITY_KEY,
    ]);
    const updated = f.storage.getItem(CONFIG_INTEGRITY_KEY);
    expect(updated.stores[contacts]).toEqual({ contacts: 'invalid' });
    expect(updated.stores[whitelist]).toBeNull();
    expect(updated.stores[security]).toEqual(metadata.stores[security]);
    expect(updated.stores[rpc].customRPC).toBe(
      sign(TEST_HMAC_KEY, '[1,"rpc","customRPC",true,null]'),
    );
  });

  it('preserves invalid root metadata and keeps accepting edits', async () => {
    const f = createFixture();
    f.disk.set(whitelist, '{}');
    await f.start();
    f.disk.set(CONFIG_INTEGRITY_KEY, '{"version":2,"stores":{}}');
    f.events.length = 0;
    const observer = await f.start();
    observer.storage.setItem(whitelist, { enabled: true });
    expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe('{"version":2,"stores":{}}');
    expect(f.events).toEqual([{ reason: 'metadata_invalid' }, whitelist]);
  });

  it.each([true, false])(
    'reuses a retained Keychain baseline after a local reset (record created before scan: %s)',
    async beforeScan => {
      const f = createFixture();
      await f.start();
      f.disk.clear();
      f.events.length = 0;
      const restarted = f.process();
      if (beforeScan) {
        restarted.storage.setItem(contacts, { aliases: {} });
      }
      await restarted.start(f.runtime);
      if (!beforeScan) {
        expect(f.storage.getItem(CONFIG_INTEGRITY_KEY).stores).toEqual({});
        restarted.storage.setItem(contacts, { aliases: {} });
      }
      expect(f.keychain.create).toHaveBeenCalledTimes(1);
      expect(f.keychain.update).toHaveBeenCalledTimes(1);
      expect(
        f.storage.getItem(CONFIG_INTEGRITY_KEY).stores[contacts],
      ).toHaveProperty('contacts');
      expect(f.diagnostics()).toEqual([]);
      f.events.length = 0;
      await f.start();
      expect(f.events).toEqual([]);
    },
  );

  it('advances directly from registry v1 to v5, validates partially signed additions and preserves newer formats on rollback', async () => {
    const f = createFixture();
    f.disk.set(rpc, '{"customRPC":{},"v2":2,"v4":4}');
    f.disk.set(contacts, '{}');
    await f.start();

    const metadata = f.storage.getItem(CONFIG_INTEGRITY_KEY);
    delete metadata.stores[contacts].contacts;
    metadata.stores[rpc].v2 = '00'.repeat(32);
    f.disk.set(CONFIG_INTEGRITY_KEY, JSON.stringify(metadata));
    const v5: Registry = {
      version: 5,
      stores: { ...registry.stores, [rpc]: { customRPC: 1, v2: 2, v4: 4 } },
    };

    f.events.length = 0;
    f.failWritesFor(CONFIG_INTEGRITY_KEY);
    await f.start(v5);
    expect(f.getKey().baselineRegistryVersion).toBe(1);
    expect(f.events).toEqual([
      { reason: 'hmac_mismatch', store: rpc, field: 'v2' },
      { reason: 'metadata_invalid', store: contacts, field: 'contacts' },
      { reason: 'metadata_write_failed', store: rpc },
    ]);

    f.events.length = 0;
    f.failWritesFor();
    await f.start(v5);
    expect(f.events).toEqual([
      { reason: 'hmac_mismatch', store: rpc, field: 'v2' },
      { reason: 'metadata_invalid', store: contacts, field: 'contacts' },
      CONFIG_INTEGRITY_KEY,
      'keychain:update',
    ]);
    expect(f.getKey()).toEqual({
      key: TEST_HMAC_KEY,
      baselineRegistryVersion: 5,
    });
    const newer = f.disk.get(CONFIG_INTEGRITY_KEY);
    const older = await f.start();
    older.storage.setItem(rpc, { customRPC: { ETH: { enable: false } } });
    expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(newer);
    expect(f.getKey().baselineRegistryVersion).toBe(5);
  });

  it('signs a normal field after key readiness and before the scan while preserving a missing store for reporting', async () => {
    const f = createFixture();
    f.disk.set(contacts, '{}');
    f.disk.set(rpc, '{}');
    await f.start();
    const metadata = f.storage.getItem(CONFIG_INTEGRITY_KEY);
    delete metadata.stores[contacts];
    f.disk.set(CONFIG_INTEGRITY_KEY, JSON.stringify(metadata));
    f.events.length = 0;
    const restarted = f.process();
    const scan = restarted.start(f.runtime);
    await Promise.resolve();
    await Promise.resolve();
    restarted.storage.setItem(rpc, { customRPC: { ETH: { enable: false } } });
    restarted.storage.setItem(contacts, { aliases: {} });
    expect(f.events).toEqual([rpc, CONFIG_INTEGRITY_KEY, contacts]);
    await scan;
    expect(f.events.slice(3)).toEqual([
      { reason: 'metadata_missing', store: contacts },
      CONFIG_INTEGRITY_KEY,
    ]);
  });

  it('leaves existing metadata intact when business storage fails and ignores default RPC edits', async () => {
    const f = createFixture();
    f.disk.set(rpc, '{"customRPC":{},"defaultRPC":{}}');
    const observer = await f.start();
    const old = f.disk.get(CONFIG_INTEGRITY_KEY);
    f.events.length = 0;
    observer.storage.setItem(rpc, { customRPC: {}, defaultRPC: { eth: {} } });
    f.failWritesFor(rpc);
    expect(() =>
      observer.storage.setItem(rpc, { customRPC: { ETH: {} } }),
    ).toThrow('disk write failed');
    expect(f.events).toEqual([rpc]);
    expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(old);
  });

  it.each(['compute', 'write', 'key-not-ready'] as const)(
    'keeps business writes when observation is interrupted at %s, then reports and repairs after restart',
    async failure => {
      const f = createFixture();
      f.disk.set(contacts, '{}');
      const observer = await f.start();
      const old = f.disk.get(CONFIG_INTEGRITY_KEY);
      f.events.length = 0;
      if (failure === 'compute') {
        (f.runtime.sign as jest.Mock).mockReturnValueOnce('unusable');
      }
      if (failure === 'write') {
        f.failWritesFor(CONFIG_INTEGRITY_KEY);
      }
      const writer = failure === 'key-not-ready' ? f.process() : observer;
      writer.storage.setItem(contacts, { contacts: { sample: {} } });
      expect(f.storage.getItem(contacts)).toEqual({ contacts: { sample: {} } });
      expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(old);
      expect(f.diagnostics()).toEqual(
        failure === 'key-not-ready'
          ? []
          : [
              {
                reason:
                  failure === 'compute'
                    ? 'hmac_compute_failed'
                    : 'metadata_write_failed',
                store: contacts,
                field: 'contacts',
              },
            ],
      );
      f.failWritesFor();
      f.events.length = 0;
      await f.start();
      expect(f.events).toEqual([
        { reason: 'hmac_mismatch', store: contacts, field: 'contacts' },
        CONFIG_INTEGRITY_KEY,
      ]);
      f.events.length = 0;
      await f.start();
      expect(f.events).toEqual([]);
    },
  );

  it('preserves old signatures through repeated Keychain failures and repairs after recovery', async () => {
    const f = createFixture();
    f.disk.set(contacts, '{}');
    await f.start();
    const old = f.disk.get(CONFIG_INTEGRITY_KEY);

    for (const alias of ['first edit', 'second edit']) {
      f.events.length = 0;
      f.keychain.read.mockRejectedValueOnce(new Error('locked'));
      const observer = await f.start();
      observer.storage.setItem(contacts, { aliases: { alias } });
      expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(old);
      expect(f.events).toEqual([{ reason: 'key_read_failed' }, contacts]);
    }

    f.events.length = 0;
    await f.start();
    expect(f.events).toEqual([
      { reason: 'hmac_mismatch', store: contacts, field: 'aliases' },
      CONFIG_INTEGRITY_KEY,
    ]);
  });

  it('reports missing key once and does not replace it while metadata is still present', async () => {
    const f = createFixture();
    f.disk.set(rpc, '{}');
    f.disk.set(contacts, '{}');
    await f.start();
    const old = f.disk.get(CONFIG_INTEGRITY_KEY);
    f.setKey(null);
    f.events.length = 0;
    const observer = await f.start();
    observer.storage.setItem(rpc, { customRPC: { ETH: {} } });
    observer.storage.setItem(contacts, { contacts: {} });
    expect(f.events).toEqual([{ reason: 'key_missing' }, rpc, contacts]);
    expect(f.disk.get(CONFIG_INTEGRITY_KEY)).toBe(old);
    expect(f.getKey()).toBeNull();
    expect(f.keychain.create).toHaveBeenCalledTimes(1);
  });
});
