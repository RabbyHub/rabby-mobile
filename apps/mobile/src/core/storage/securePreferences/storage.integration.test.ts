import { createHmac } from 'crypto';
import { createPersistStore } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storeConstant';
import { createSecurePreferenceStorage } from './storage';
import type { SecurePreferenceReport } from './types';

const whitelist = APP_STORE_NAMES.whitelist;
const contactBook = APP_STORE_NAMES.contactBook;
const securityEngine = APP_STORE_NAMES.securityEngine;
const rpc = APP_STORE_NAMES.rpc;
const protectedNames = [whitelist, contactBook, securityEngine, rpc];
const protectedKey = (name: string) => `secure-preference:${name}`;
const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacement = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const whitelistData = { enabled: true, whitelists: [{ address }] };
const whitelistDefault = { enabled: true, whitelists: [] };

function fixture() {
  const values = new Map<string, string>();
  const reports: SecurePreferenceReport[] = [];
  let failingWrite: string | undefined;
  let failingRead: string | undefined;
  let hasWalletData = false;
  const disk = {
    read: (key: string) => {
      if (key === failingRead) {
        throw new Error('Storage temporarily inaccessible');
      }
      return values.get(key) ?? null;
    },
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
    reports,
    restart() {
      stagedSecret = undefined;
      return createSecurePreferenceStorage(disk, key, {
        canInitializeEmptyInstallation: () => !hasWalletData,
        onIssue: report => reports.push(report),
      });
    },
    clearAppData() {
      values.clear();
      hasWalletData = false;
    },
    retainWalletData() {
      hasWalletData = true;
    },
    failReadsFrom(name: string) {
      failingRead = name;
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
    expect(env.reports).toEqual([
      { name: whitelist, kind: 'damaged', stage: 'record-verify' },
    ]);
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
    expect(env.reports).toEqual([
      { name: whitelist, kind: 'damaged', stage: 'record-missing' },
    ]);

    env.loseKey();
    const keyLost = env.restart();
    expect((await keyLost.getAdapter(whitelist)).getItem(whitelist)).toEqual({
      enabled: false,
      whitelists: [replacement],
    });
    expect(keyLost.getIssues()).toEqual([]);
    expect(env.getEnrollmentCount()).toBe(2);
  });

  it('signs defaults on an empty iOS reinstall using the retained Keychain key', async () => {
    const env = fixture();
    env.seed(whitelist, whitelistData);
    await env.restart().getAdapter(whitelist);
    env.clearAppData();

    const storage = env.restart();
    const adapters = await Promise.all(
      protectedNames.map(name => storage.getAdapter(name)),
    );
    for (const [index, name] of protectedNames.entries()) {
      expect(adapters[index].getItem(name)).toEqual({});
      expect(JSON.parse(env.disk.read(protectedKey(name))!)).toEqual({
        version: 1,
        payload: '{}',
        hmac: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
    expect(storage.getIssues()).toEqual([]);
    expect(env.getEnrollmentCount()).toBe(1);

    const reopened = env.restart();
    expect((await reopened.getAdapter(whitelist)).getItem(whitelist)).toEqual(
      {},
    );
    expect(reopened.getIssues()).toEqual([]);
    expect(env.reports).toEqual([]);
  });

  it('resumes signing defaults after an interrupted reinstall', async () => {
    const env = fixture();
    await env.restart().getAdapter(whitelist);
    env.clearAppData();
    env.interruptWriteTo(protectedKey(contactBook));

    const interrupted = env.restart();
    await interrupted.getAdapter(contactBook);
    expect(interrupted.getIssues()).toEqual([
      { name: contactBook, kind: 'unavailable' },
    ]);
    const signedWhitelist = env.disk.read(protectedKey(whitelist));
    expect(signedWhitelist).not.toBeNull();

    const resumed = env.restart();
    await Promise.all(protectedNames.map(name => resumed.getAdapter(name)));
    expect(resumed.getIssues()).toEqual([]);
    expect(env.disk.read(protectedKey(whitelist))).toBe(signedWhitelist);
    expect(env.getEnrollmentCount()).toBe(1);
  });

  it.each(['installation marker', 'wallet', 'legacy record', 'invalid record'])(
    'keeps integrity protection when all records are missing or invalid with a retained %s',
    async retained => {
      const env = fixture();
      await env.restart().getAdapter(whitelist);
      if (retained === 'installation marker') {
        protectedNames.forEach(name => env.disk.remove(protectedKey(name)));
      } else {
        env.clearAppData();
      }
      if (retained === 'wallet') env.retainWalletData();
      if (retained === 'legacy record') env.seed(whitelist, whitelistData);
      if (retained === 'invalid record') {
        env.disk.write(protectedKey(whitelist), '');
      }

      const storage = env.restart();
      await storage.getAdapter(contactBook);
      expect(storage.getIssues()).toEqual([
        { name: contactBook, kind: 'damaged' },
      ]);
      expect(env.disk.read(protectedKey(contactBook))).toBeNull();
    },
  );

  it('does not register defaults when an empty installation cannot be verified', async () => {
    const env = fixture();
    await env.restart().getAdapter(whitelist);
    env.clearAppData();
    env.failReadsFrom(protectedKey(whitelist));

    const storage = env.restart();
    await storage.getAdapter(contactBook);
    expect(storage.getIssues()).toEqual([
      { name: contactBook, kind: 'unavailable' },
    ]);
    expect(env.disk.read(protectedKey(contactBook))).toBeNull();
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
      expect(env.reports).toEqual([
        {
          name: contactBook,
          kind: 'unavailable',
          stage:
            interruption === 'before all writes'
              ? 'initialize-records'
              : 'key-commit',
        },
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
    expect(env.reports).toEqual([
      { name: whitelist, kind: 'unavailable', stage: 'key-open' },
    ]);
    adapter.setItem(whitelist, { enabled: false, whitelists: [] });
    await storage.reset([whitelist]);
    expect(env.disk.read(whitelist)).toBe(JSON.stringify(whitelistData));
    expect(env.getEnrollmentCount()).toBe(0);
  });

  it('reports a write failure once while preserving the signed record', async () => {
    const env = fixture();
    env.seed(whitelist, whitelistData);
    const storage = env.restart();
    const adapter = await storage.getAdapter(whitelist);
    const key = protectedKey(whitelist);
    const signed = env.disk.read(key);
    env.interruptWriteTo(key);
    adapter.setItem(whitelist, { enabled: false, whitelists: [replacement] });
    adapter.setItem(whitelist, { enabled: false, whitelists: [] });

    expect(env.reports).toEqual([
      { name: whitelist, kind: 'unavailable', stage: 'record-write' },
    ]);
    expect(env.disk.read(key)).toBe(signed);
  });
});
