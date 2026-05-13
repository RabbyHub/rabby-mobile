import * as sinon from 'sinon';

const webcrypto = jest.requireActual('crypto').webcrypto;
Object.defineProperty(webcrypto, 'CryptoKey', {
  value: class JestCryptoKey {
    static [Symbol.hasInstance](instance: unknown) {
      return Object.prototype.toString.call(instance) === '[object CryptoKey]';
    }
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

jest.mock(
  'react-native-quick-crypto',
  () => ({
    pbkdf2Sync: jest.requireActual('crypto').pbkdf2Sync,
  }),
  { virtual: true },
);

jest.mock(
  '@craftzdog/react-native-buffer',
  () => ({
    Buffer: jest.requireActual('buffer').Buffer,
  }),
  { virtual: true },
);

import { KeyringService } from './keyringService';

const password = 'password123';

describe('KeyringService setup', () => {
  let keyringService: KeyringService;

  beforeAll(() => {
    keyringService = new KeyringService({});
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
    keyringService = new KeyringService();
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

      await expect(
        keyringService.submitPassword('wrong-password'),
      ).rejects.toThrow();
      expect((keyringService as any)._isSubmittingPassword).toBe(false);

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
