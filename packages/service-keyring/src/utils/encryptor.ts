import * as browserPasswordor from './browser-password';

type EncryptorPayload = { iv: string, encryptedData: string, salt: string };
export interface EncryptorAdapter {
  encrypt<T extends object>(password: string, data: string | T | Buffer): Promise<string>;
  decrypt<T = any>(password: string, encryptedData: string | EncryptorPayload): Promise<T>;
}

export const nodeEncryptor: EncryptorAdapter = {
  encrypt: browserPasswordor.encrypt,
  decrypt: browserPasswordor.decrypt,
}
