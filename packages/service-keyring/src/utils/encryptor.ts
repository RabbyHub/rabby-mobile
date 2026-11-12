import * as browserPasswordor from '@metamask/browser-passworder';

export type EncryptorDecryptDetail = {
  vault: any;
  exportedKeyString?: string;
  salt?: string;
};

export type EncryptorAdapter = {
  encrypt: (password: string, object: any) => Promise<string>;
  decrypt: (password: string, encryptedString: string) => Promise<any>;
  decryptWithDetail: (
    password: string,
    encryptedString: string,
  ) => Promise<EncryptorDecryptDetail>;
  decryptWithExportedKey: (
    encryptedVault: string,
    exportedKeyString: string,
  ) => Promise<any>;
};

export const nodeEncryptor = {
  encrypt: browserPasswordor.encrypt,
  decrypt: browserPasswordor.decrypt,
  decryptWithDetail: browserPasswordor.decryptWithDetail,
  decryptWithExportedKey: async (
    encryptedVault: string,
    exportedKeyString: string,
  ) => {
    const key = await browserPasswordor.importKey(exportedKeyString);
    return browserPasswordor.decrypt('', encryptedVault, key);
  },
} satisfies EncryptorAdapter;
