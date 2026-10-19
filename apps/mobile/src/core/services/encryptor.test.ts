import { createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import Aes from 'react-native-aes-crypto';
import RNEncryptor from './encryptor';
import {
  describeEncryptedInput,
  describePasswordPayload,
  type DecryptDiagnosticEvent,
} from '../utils/encryptorDiagnostics';

jest.mock('react-native-aes-crypto', () => ({
  __esModule: true,
  default: { pbkdf2: jest.fn(), decrypt: jest.fn() },
}));

const password = 'synthetic-rabbit-code';
const salt = 'synthetic-salt';
const iv = '000102030405060708090a0b0c0d0e0f';
const fixturePayload = { password: 'synthetic-managed-password' };
const key = pbkdf2Sync(password, salt, 5000, 32, 'sha256');

function encryptFixture(plaintext: string) {
  const cipher = createCipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  return JSON.stringify({
    cipher: Buffer.concat([cipher.update(plaintext), cipher.final()]).toString(
      'base64',
    ),
    iv,
    salt,
  });
}

describe('RNEncryptor managed-password diagnostics', () => {
  beforeEach(() => {
    jest
      .mocked(Aes.pbkdf2)
      .mockReset()
      .mockImplementation(
        async (inputPassword, inputSalt, iterations, bits, algorithm) =>
          pbkdf2Sync(
            inputPassword,
            inputSalt,
            iterations,
            bits / 8,
            algorithm,
          ).toString('hex'),
      );
    jest
      .mocked(Aes.decrypt)
      .mockReset()
      .mockImplementation(async (ciphertext, keyHex, ivHex, algorithm) => {
        const cipher = createDecipheriv(
          algorithm,
          Buffer.from(keyHex, 'hex'),
          Buffer.from(ivHex, 'hex'),
        );
        return Buffer.concat([
          cipher.update(Buffer.from(ciphertext, 'base64')),
          cipher.final(),
        ]).toString('utf8');
      });
  });

  it('preserves crypto inputs/results and emits only structural metadata', async () => {
    const encryptor = new RNEncryptor();
    const encrypted = encryptFixture(JSON.stringify(fixturePayload));
    const events: DecryptDiagnosticEvent[] = [];
    await expect(encryptor.decrypt(password, encrypted)).resolves.toEqual(
      fixturePayload,
    );
    await expect(
      encryptor.decrypt(password, encrypted, event => events.push(event)),
    ).resolves.toEqual(fixturePayload);
    expect(Aes.pbkdf2).toHaveBeenLastCalledWith(
      password,
      salt,
      5000,
      256,
      'sha256',
    );
    expect(
      events
        .filter(event => event.outcome === 'succeeded')
        .map(event => event.phase),
    ).toEqual([
      'envelope_json',
      'envelope_shape',
      'derive_key',
      'decrypt_cipher',
      'plaintext_json',
    ]);
    expect(
      events.find(event => event.phase === 'envelope_shape'),
    ).toMatchObject({
      cipherBase64ShapeValid: true,
      ivHexShapeValid: true,
      saltIsString: true,
    });
    for (const secret of [
      password,
      salt,
      iv,
      key.toString('hex'),
      fixturePayload.password,
      JSON.parse(encrypted).cipher,
    ]) {
      expect(JSON.stringify(events)).not.toContain(secret);
    }
  });

  it.each(['envelope_json', 'plaintext_json'] as const)(
    'identifies a control character failure at %s without logging its content',
    async phase => {
      const invalid = '{"password":"synthetic-private\u0000value"}';
      const input =
        phase === 'envelope_json' ? invalid : encryptFixture(invalid);
      const events: DecryptDiagnosticEvent[] = [];
      await expect(
        new RNEncryptor().decrypt(password, input, event => events.push(event)),
      ).rejects.toBeInstanceOf(SyntaxError);
      expect(events.at(-1)).toEqual({
        phase,
        outcome: 'failed',
        errorKind: 'syntax',
      });
      expect(JSON.stringify(events)).not.toContain('synthetic-private');
      if (phase === 'envelope_json') {
        expect(Aes.pbkdf2).not.toHaveBeenCalled();
        expect(events[0]).toMatchObject({
          nulCount: 1,
          controlCharacterCount: 1,
        });
      } else {
        expect(Aes.decrypt).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(['derive_key', 'decrypt_cipher'] as const)(
    'rethrows the original native failure at %s without serializing it',
    async phase => {
      const failure = Object.assign(new Error('synthetic-secret-exception'), {
        code: 'secret-code',
      });
      jest
        .mocked(phase === 'derive_key' ? Aes.pbkdf2 : Aes.decrypt)
        .mockRejectedValueOnce(failure);
      const events: DecryptDiagnosticEvent[] = [];
      await expect(
        new RNEncryptor().decrypt(password, encryptFixture('{}'), event =>
          events.push(event),
        ),
      ).rejects.toBe(failure);
      expect(events.at(-1)).toEqual({
        phase,
        outcome: 'failed',
        errorKind: 'other',
      });
      expect(JSON.stringify(events)).not.toContain('secret');
    },
  );

  it('does not make malformed envelope shape into a new validation rule', async () => {
    const failure = new Error('native missing salt');
    jest.mocked(Aes.pbkdf2).mockRejectedValueOnce(failure);
    const events: DecryptDiagnosticEvent[] = [];
    await expect(
      new RNEncryptor().decrypt(password, '{}', event => events.push(event)),
    ).rejects.toBe(failure);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      undefined,
      5000,
      256,
      'sha256',
    );
    expect(
      events.find(event => event.phase === 'envelope_shape'),
    ).toMatchObject({
      cipherIsString: false,
      ivIsString: false,
      saltIsString: false,
    });
  });

  it('isolates observer failures and does not coerce the decrypted value', async () => {
    const observer = () => {
      throw new Error('log unavailable');
    };
    const encryptor = new RNEncryptor();
    await expect(
      encryptor.decrypt(password, encryptFixture('null'), observer),
    ).resolves.toBeNull();
    const failure = new Error('original crypto failure');
    jest.mocked(Aes.decrypt).mockRejectedValueOnce(failure);
    await expect(
      encryptor.decrypt(password, encryptFixture('{}'), observer),
    ).rejects.toBe(failure);
  });

  it('bounds structural scans and describes credential presence without values', () => {
    expect(describeEncryptedInput('a'.repeat(70_000))).toMatchObject({
      inputLength: 70_000,
      scannedLength: 65_536,
    });
    expect(describePasswordPayload(fixturePayload)).toEqual({
      isObject: true,
      passwordIsString: true,
      hasPassword: true,
      vaultKeyIsString: false,
    });
    expect(describePasswordPayload(null).isObject).toBe(false);
  });
});
