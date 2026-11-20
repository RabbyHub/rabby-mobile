import * as sinon from 'sinon';

import { KeyringService } from './keyringService';
import mockEncryptor from '../test/mock-encryptor';

const password = 'password123';

describe('KeyringService setup', () => {
  let keyringService: KeyringService;

  beforeAll(() => {
    keyringService = new KeyringService({ encryptor: mockEncryptor as any });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('boot', () => {
    it('should load store', async () => {
      keyringService.loadStore({});
      expect(keyringService.store).toBeDefined();
    });

    it('should booted', async () => {
      keyringService.boot('password');
      expect(keyringService.store.getState().booted).toBeUndefined();
    });
  });

  describe('setLocked', () => {
    it('setLocked correctly sets lock state', async () => {
      await keyringService.setLocked();
      await expect(keyringService.persistAllKeyrings()).rejects.toThrow(
        'KeyringService - password is not a string',
      );
      expect(keyringService.memStore.getState().isUnlocked).toBe(false);
      expect(keyringService.keyrings).toHaveLength(0);
    });

    it('emits "lock" event', async () => {
      const spy = sinon.spy();
      keyringService.on('lock', spy);
      await keyringService.setLocked();
      expect(spy.calledOnce).toBe(true);
    });

    it('cancels and cleans up only OneKey keyrings on lock', async () => {
      const onekey = {
        type: 'Onekey Hardware',
        cancelPendingWork: sinon.stub().resolves(undefined),
        cleanUp: sinon.stub().resolves(undefined),
      };
      const other = {
        type: 'HD Key Tree',
        cancelPendingWork: sinon.stub().resolves(undefined),
        cleanUp: sinon.stub().resolves(undefined),
      };
      keyringService.keyrings = [onekey, other] as any;

      await keyringService.setLocked();

      expect(onekey.cancelPendingWork.calledOnce).toBe(true);
      expect(onekey.cleanUp.calledOnce).toBe(true);
      expect(other.cancelPendingWork.called).toBe(false);
      expect(other.cleanUp.called).toBe(false);
    });
  });
});

describe('OneKey passphrase persistence', () => {
  const oneKeyPassword = 'password123';

  it('persists after signing when a stale passphrase state was cleared', async () => {
    const keyringService = new KeyringService({
      encryptor: mockEncryptor as any,
    });
    keyringService.loadStore({});
    await keyringService.boot(oneKeyPassword);
    const keyring = {
      type: 'Onekey Hardware',
      signTransaction: sinon.stub().resolves('signed'),
      consumePassphraseStateCleared: sinon.stub().returns(true),
    };
    const persist = sinon
      .stub(keyringService, 'persistAllKeyrings')
      .resolves(true);

    const signed = await keyringService.signTransaction(
      keyring,
      {},
      '0x1111111111111111111111111111111111111111',
      {},
    );
    expect(signed).toBe('signed');
    expect(keyring.consumePassphraseStateCleared.calledOnce).toBe(true);
    expect(persist.calledOnce).toBe(true);
  });

  it('does not persist when recovery did not clear a stored passphrase', async () => {
    const keyringService = new KeyringService({
      encryptor: mockEncryptor as any,
    });
    keyringService.loadStore({});
    await keyringService.boot(oneKeyPassword);
    const keyring = {
      type: 'Onekey Hardware',
      signPersonalMessage: sinon.stub().resolves('0xsig'),
      consumePassphraseStateCleared: sinon.stub().returns(false),
    };
    const persist = sinon
      .stub(keyringService, 'persistAllKeyrings')
      .resolves(true);

    await keyringService.signPersonalMessage(keyring, {
      from: '0x1111111111111111111111111111111111111111',
      data: '0x01',
    });

    expect(persist.called).toBe(false);
  });

  it('does not persist a cleared passphrase after the wallet is locked', async () => {
    const keyringService = new KeyringService({
      encryptor: mockEncryptor as any,
    });
    keyringService.loadStore({});
    await keyringService.boot(oneKeyPassword);
    keyringService.memStore.updateState({ isUnlocked: false });
    const keyring = {
      type: 'Onekey Hardware',
      signTypedData: sinon.stub().resolves('0xsig'),
      consumePassphraseStateCleared: sinon.stub().returns(true),
    };
    const persist = sinon
      .stub(keyringService, 'persistAllKeyrings')
      .resolves(true);

    await keyringService.signTypedMessage(
      keyring,
      {
        from: '0x1111111111111111111111111111111111111111',
        data: {},
      },
      { version: 'V4' },
    );

    expect(keyring.consumePassphraseStateCleared.calledOnce).toBe(true);
    expect(persist.called).toBe(false);
  });
});

describe('keyringService', () => {
  let keyringService: KeyringService;

  beforeEach(async () => {
    keyringService = new KeyringService({ encryptor: mockEncryptor as any });
    keyringService.loadStore({});
    await keyringService.boot(password);
    await keyringService.clearKeyrings();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('submitPassword', () => {
    it('emits "unlock" event', async () => {
      await keyringService.setLocked();
      const spy = sinon.spy();
      keyringService.on('unlock', spy);

      await keyringService.submitPassword(password);
      expect(spy.calledOnce).toBe(true);
    });

    it('resets the submitting guard when password verification fails', async () => {
      await keyringService.setLocked();
      sinon
        .stub(keyringService, 'verifyPassword')
        .rejects(new Error('bad password'));

      await expect(
        keyringService.submitPassword('wrong-password'),
      ).rejects.toThrow('bad password');
      expect((keyringService as any)._isSubmittingPassword).toBe(false);

      sinon.restore();
      await keyringService.submitPassword(password);
      expect(keyringService.memStore.getState().isUnlocked).toBe(true);
    });

    it('skips pre-verification for trusted passwords when a vault exists', async () => {
      await keyringService.setLocked();
      keyringService.store.updateState({ vault: 'encrypted-vault' });

      const verifySpy = sinon.spy(keyringService, 'verifyPassword');
      const unlockStub = sinon
        .stub(keyringService, 'unlockKeyrings')
        .resolves([]);

      await keyringService.submitPassword(password, { trustedPassword: true });

      expect(verifySpy.called).toBe(false);
      expect(unlockStub.calledOnce).toBe(true);
      expect(unlockStub.firstCall.args[0]).toBe(password);
      expect(keyringService.memStore.getState().isUnlocked).toBe(true);
    });

    it('rejects trusted passwords when vault decryption fails', async () => {
      await keyringService.setLocked();
      keyringService.store.updateState({ vault: 'encrypted-vault' });

      const verifySpy = sinon.spy(keyringService, 'verifyPassword');
      sinon
        .stub(keyringService, 'unlockKeyrings')
        .rejects(new Error('bad vault'));

      await expect(
        keyringService.submitPassword(password, { trustedPassword: true }),
      ).rejects.toThrow('bad vault');

      expect(verifySpy.called).toBe(false);
      expect(keyringService.memStore.getState().isUnlocked).toBe(false);
      expect((keyringService as any)._isSubmittingPassword).toBe(false);
    });
  });

  describe('startDeferredKeyringRuntimeRestore', () => {
    it('does not let late restore completions mutate runtime keyrings after a failure', async () => {
      let releaseSlowRestore!: () => void;

      class SlowKeyring {
        static type = 'SlowKeyring';
        type = 'SlowKeyring';

        async deserialize() {
          await new Promise<void>(resolve => {
            releaseSlowRestore = resolve;
          });
        }

        async getAccounts() {
          return ['0xslow'];
        }
      }

      class FailingKeyring {
        static type = 'FailingKeyring';
        type = 'FailingKeyring';

        async deserialize() {
          throw new Error('restore failed');
        }

        async getAccounts() {
          return [];
        }
      }

      keyringService = new KeyringService({
        encryptor: mockEncryptor as any,
        keyringClasses: [SlowKeyring, FailingKeyring] as any,
      });
      keyringService.loadStore({
        hasEncryptedKeyringData: true,
      });
      await keyringService.boot(password);

      const previousKeyring = {
        type: 'PreviousKeyring',
      } as any;
      keyringService.keyrings = [previousKeyring];
      keyringService.memStore.updateState({
        keyringRuntimeReady: false,
      });
      (keyringService as any).pendingKeyringRuntimeRestore = {
        keyringsToRestore: [
          { type: 'SlowKeyring', data: {} },
          { type: 'FailingKeyring', data: {} },
        ],
        unencryptedKeyringData: [],
        hasUnencryptedKeyringData: false,
        scheduledAt: Date.now(),
      };

      await expect(
        keyringService.startDeferredKeyringRuntimeRestore('test'),
      ).rejects.toThrow('restore failed');
      expect(keyringService.keyrings).toEqual([previousKeyring]);

      releaseSlowRestore();
      await Promise.resolve();
      await Promise.resolve();

      expect(keyringService.keyrings).toEqual([previousKeyring]);
    });
  });
});
