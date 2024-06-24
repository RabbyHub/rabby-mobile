import * as sinon from 'sinon';
import { KeyringService } from '../src/keyringService';
import mockEncryptor from '../test/mock-encryptor';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';

const password = 'password123';

describe('KeyringService setup', () => {
  let keyringService: KeyringService;

  beforeAll(() => {
    keyringService = new KeyringService();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('boot', () => {
    it('should load store', async () => {
      keyringService.loadStore({});
      expect(keyringService.store).not.toBeUndefined();
    });

    it('should booted', async () => {
      keyringService.boot('password');
      expect(keyringService.store.getState().booted).toBeUndefined();
    });
  });

  describe('setLocked', () => {
    it('setLocked correctly sets lock state', async () => {
      await keyringService.setLocked();
      expect(keyringService.password).toBeNull();
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

describe('keyringService support eth-keyring-watch', () => {
  let keyringService: KeyringService;

  const TEST_ADDR = '0x39b97205b9826f21fd39b535cf972c809e160e5f';

  beforeEach(async () => {
    keyringService = new KeyringService();
    keyringService.loadStore({});
    await keyringService.boot(password);
    await keyringService.clearKeyrings();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('keyring', () => {
    it('#addNewKeyring', async () => {
      const spy = sinon.spy();
      const spyCallback = sinon.spy();

      keyringService.on('newAccount', spy);
      expect(spy.calledOnce).toBe(false);
      expect(spyCallback.calledOnce).toBe(false);

      let keyring = await keyringService.addNewKeyring('Watch Address' as KeyringTypeName);

      keyring.setAccountToAdd(TEST_ADDR);

      keyringService.addListener('newAccount', spyCallback);

      await keyringService.addNewAccount(keyring);
      expect(spy.calledOnce).toBe(true);
      expect(spyCallback.calledOnce).toBe(true);
    });
  });
});
