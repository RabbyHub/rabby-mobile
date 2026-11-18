import { createHmac } from 'crypto';
import { createPersistStore } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storeConstant';
import { createSecurePreferenceStorage } from './storage';

const whitelist = APP_STORE_NAMES.whitelist;
const contactBook = APP_STORE_NAMES.contactBook;
const securityEngine = APP_STORE_NAMES.securityEngine;
const rpc = APP_STORE_NAMES.rpc;
const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacement = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const whitelistData = { enabled: true, whitelists: [{ address }] };
const whitelistDefault = { enabled: true, whitelists: [] };

function fixture() {
  const values = new Map<string, string>();
  let failingWrite: string | undefined;
  const disk = {
    read: (key: string) => values.get(key) ?? null,
    write: (key: string, value: string) => {
      if (key === failingWrite) {
        failingWrite = undefined;
        throw new Error('Interrupted migration write');
      }
      values.set(key, value);
    },
    remove: (key: string) => {
      values.delete(key);
    },
  };
  let secret: string | undefined;
  let stagedSecret: string | undefined;
  let generation = 0;
  let enrollmentCount = 0;
  let locked = false;
  let failingCommit = false;
  const key = {
    async open(stage: boolean) {
      if (locked) {
        throw new Error('Device locked');
      }
      if (secret) {
        return 'ready' as const;
      }
      if (!stage) {
        return 'missing' as const;
      }
      stagedSecret ??= `test-key-${++generation}`;
      return 'staged' as const;
    },
    async commit() {
      if (failingCommit || !stagedSecret) {
        failingCommit = false;
        throw new Error('Interrupted migration commit');
      }
      secret = stagedSecret;
      stagedSecret = undefined;
      enrollmentCount += 1;
    },
    mac(message: string) {
      const activeSecret = secret ?? stagedSecret;
      if (locked || !activeSecret) {
        return '';
      }
      return createHmac('sha256', activeSecret).update(message).digest('hex');
    },
  };
  return {
    disk,
    restart() {
      stagedSecret = undefined;
      return createSecurePreferenceStorage(disk, key);
    },
    seed(name: string, value: unknown) {
      disk.write(name, JSON.stringify(value));
    },
    interruptWriteTo(name: string) {
      failingWrite = name;
    },
    interruptCommit() {
      failingCommit = true;
    },
    loseKey() {
      secret = undefined;
    },
    lockDevice() {
      locked = true;
    },
    getEnrollmentCount: () => enrollmentCount,
  };
}

describe('secure preference persistence', () => {
  it('concurrently enrolls legacy groups once and persists edits across launch', async () => {
    const env = fixture();
    env.seed(whitelist, { enabled: true, whitelists: [address] });
    const oldAddress = `0x${address.slice(2).toUpperCase()}`;
    env.seed(contactBook, {
      aliases: { [oldAddress]: { address: oldAddress, alias: 'Saving' } },
    });
    const userRule = {
      id: '1001',
      enable: false,
      customThreshold: {
        warning: { min: null, max: 100, minIncluded: false, maxIncluded: true },
      },
    };
    env.seed(securityEngine, {
      userData: {
        originWhitelist: [],
        originBlacklist: ['https://example.test'],
      },
      rules: [userRule],
    });
    const first = env.restart();
    const [whitelistAdapter, contactsAdapter, engineAdapter] =
      await Promise.all([
        first.getAdapter(whitelist),
        first.getAdapter(contactBook),
        first.getAdapter(securityEngine),
      ]);
    const controller = createPersistStore(
      {
        name: whitelist,
        template: { enabled: true, whitelists: [] as string[] },
      },
      { storage: whitelistAdapter },
    );
    expect(controller.getSnapshot().whitelists).toEqual([address]);
    expect(contactsAdapter.getItem(contactBook)).toEqual({
      aliases: { [address]: { address: oldAddress, alias: 'Saving' } },
    });
    expect(engineAdapter.getItem(securityEngine)).toMatchObject({
      userData: { originBlacklist: ['https://example.test'] },
      rules: [userRule],
    });

    controller.update(draft => {
      draft.whitelists.push(replacement);
    });
    controller.flushNow();

    expect(env.getEnrollmentCount()).toBe(1);
    expect(env.disk.read(whitelist)).toBeNull();
    expect(env.disk.read(contactBook)).toBeNull();
    const second = await env.restart().getAdapter(whitelist);
    expect(second.getItem(whitelist)).toEqual({
      enabled: true,
      whitelists: [address, replacement],
    });
  });

  it('uses defaults immediately and replaces only the damaged record after confirmation', async () => {
    const env = fixture();
    env.seed(whitelist, whitelistData);
    env.seed(contactBook, {
      aliases: { [address]: { address, alias: 'Verified' } },
    });
    await env.restart().getAdapter(whitelist);
    const recordKey = `secure-preference:${whitelist}`;
    const contactKey = `secure-preference:${contactBook}`;
    const otherRecord = env.disk.read(contactKey);
    const modified = env.disk.read(recordKey)!.replace(address, replacement);
    env.disk.write(recordKey, modified);

    const storage = env.restart();
    const adapter = await storage.getAdapter(whitelist);
    const controller = createPersistStore(
      { name: whitelist, template: whitelistDefault },
      { storage: adapter },
    );
    expect(controller.getSnapshot()).toEqual(whitelistDefault);
    expect(storage.getIssues()).toEqual([{ name: whitelist, kind: 'damaged' }]);
    expect(env.disk.read(recordKey)).toBe(modified);

    await storage.reset([whitelist]);
    expect(storage.getIssues()).toEqual([]);
    expect(env.disk.read(contactKey)).toBe(otherRecord);
    const restarted = await env.restart().getAdapter(whitelist);
    expect(restarted.getItem(whitelist)).toEqual({});
  });

  it('checks protected records when the key exists and enrolls legacy values when it is missing', async () => {
    const env = fixture();
    env.seed(whitelist, whitelistData);
    await env.restart().getAdapter(whitelist);
    env.seed(whitelist, { enabled: false, whitelists: [replacement] });
    env.disk.remove(`secure-preference:${whitelist}`);

    const deleted = env.restart();
    expect((await deleted.getAdapter(whitelist)).getItem(whitelist)).toEqual(
      {},
    );
    expect(deleted.getIssues()).toEqual([{ name: whitelist, kind: 'damaged' }]);

    env.loseKey();
    const keyLost = env.restart();
    expect((await keyLost.getAdapter(whitelist)).getItem(whitelist)).toEqual({
      enabled: false,
      whitelists: [replacement],
    });
    expect(keyLost.getIssues()).toEqual([]);
    expect(env.getEnrollmentCount()).toBe(2);
  });

  it.each(['before all writes', 'before key commit'])(
    'retries an interrupted migration %s',
    async interruption => {
      const env = fixture();
      const contactData = {
        aliases: { [address]: { address, alias: 'Legacy' } },
      };
      env.seed(whitelist, whitelistData);
      env.seed(contactBook, contactData);
      if (interruption === 'before all writes') {
        env.interruptWriteTo(`secure-preference:${contactBook}`);
      } else {
        env.interruptCommit();
      }

      const firstStart = env.restart();
      await firstStart.getAdapter(contactBook);
      expect(firstStart.getIssues()).toEqual([
        { name: contactBook, kind: 'unavailable' },
      ]);
      expect(env.getEnrollmentCount()).toBe(0);
      expect(env.disk.read(contactBook)).toBe(JSON.stringify(contactData));
      const whitelistKey = `secure-preference:${whitelist}`;
      const stagedRecord = env.disk.read(whitelistKey)!;
      // The unfinished record is never used as the source for a retry.
      env.disk.write(whitelistKey, stagedRecord.replace(address, replacement));

      const resumed = env.restart();
      const [saved, contacts] = await Promise.all([
        resumed.getAdapter(whitelist),
        resumed.getAdapter(contactBook),
      ]);
      expect(saved.getItem(whitelist)).toEqual(whitelistData);
      expect(contacts.getItem(contactBook)).toEqual(contactData);
      expect(resumed.getIssues()).toEqual([]);
      expect(env.disk.read(whitelistKey)).not.toBe(stagedRecord);
      expect(env.disk.read(contactBook)).toBeNull();
      expect(env.getEnrollmentCount()).toBe(1);
    },
  );

  it('keeps the RPC cache separate from the signed user RPC configuration', async () => {
    const env = fixture();
    const customRPC = { ETH: { url: 'https://custom.test', enable: true } };
    const defaultRPC = { eth: { rpcUrl: ['https://default.test'] } };
    env.seed(rpc, { customRPC, defaultRPC, defaultRPCLastUpdateAt: 1 });

    const adapter = await env.restart().getAdapter(rpc);
    expect(adapter.getItem(rpc)).toEqual({
      customRPC,
      defaultRPC,
      defaultRPCLastUpdateAt: 1,
    });
    const recordKey = `secure-preference:${rpc}`;
    const original = env.disk.read(recordKey)!;
    adapter.setItem(rpc, { customRPC, defaultRPC, defaultRPCLastUpdateAt: 2 });
    expect(env.disk.read(recordKey)).toBe(original);
    env.disk.write(recordKey, original.replace('custom.test', 'modified.test'));

    const storage = env.restart();
    const safeAdapter = await storage.getAdapter(rpc);
    expect(safeAdapter.getItem(rpc)).toEqual({
      defaultRPC,
      defaultRPCLastUpdateAt: 2,
    });
    expect(storage.getIssues()).toEqual([{ name: rpc, kind: 'damaged' }]);
    await storage.reset([rpc]);
    expect(env.disk.read(rpc)).toBeNull();
    expect((await env.restart().getAdapter(rpc)).getItem(rpc)).toEqual({
      defaultRPC,
      defaultRPCLastUpdateAt: 2,
    });
  });

  it('keeps original values on a temporary key store error', async () => {
    const env = fixture();
    env.seed(whitelist, whitelistData);
    env.lockDevice();
    const storage = env.restart();
    const adapter = await storage.getAdapter(whitelist);
    expect(adapter.getItem(whitelist)).toEqual({});
    expect(storage.getIssues()).toEqual([
      { name: whitelist, kind: 'unavailable' },
    ]);
    adapter.setItem(whitelist, { enabled: false, whitelists: [] });
    await storage.reset([whitelist]);
    expect(env.disk.read(whitelist)).toBe(JSON.stringify(whitelistData));
    expect(env.getEnrollmentCount()).toBe(0);
  });
});
