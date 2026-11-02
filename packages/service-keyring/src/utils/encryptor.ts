import * as browserPasswordor from '@metamask/browser-passworder';

export type EncryptorDecryptDetail = {
  vault: any;
  exportedKeyString?: string;
  salt?: string;
  kdfVersion?: string;
};

export type EncryptorEncryptDetail = {
  vault: string;
  exportedKeyString: string;
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
  /** True when the stored KDF is at least as strong as the write policy. */
  isVaultUpdated?: (encryptedString: string) => boolean;
  encryptWithDetail?: (
    password: string,
    object: any,
  ) => Promise<EncryptorEncryptDetail>;
  encryptKeyringState?: (
    password: string,
    object: any,
    currentEncryptedString?: string,
  ) => Promise<string>;
  /** Add explicit KDF metadata without re-encrypting a legacy payload. */
  normalizeKdfMetadata?: (
    encryptedString: string,
    resolvedVersion?: string,
  ) => string | null;
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
