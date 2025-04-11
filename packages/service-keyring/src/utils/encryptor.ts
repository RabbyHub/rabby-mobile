import * as browserPasswordor from '@metamask/browser-passworder';

export const nodeEncryptor = {
  encrypt: browserPasswordor.encrypt,
  decrypt: browserPasswordor.decrypt,
};

export type EncryptorAdapter = typeof nodeEncryptor;
