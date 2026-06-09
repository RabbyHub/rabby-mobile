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
});
