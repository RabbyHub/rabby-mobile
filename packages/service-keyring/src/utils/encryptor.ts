import * as browserPasswordor from './browser-password';

type EncryptorPayload = { iv: string, encryptedData: string, salt: string };
export interface EncryptorAdapter {
  encrypt(password: string, data: string | Buffer): Promise<string>;
  decrypt(password: string, encryptedData: string | EncryptorPayload): Promise<unknown>;
}

export const nodeEncryptor: EncryptorAdapter = {
  encrypt: browserPasswordor.encrypt,
  decrypt: browserPasswordor.decrypt,
}
