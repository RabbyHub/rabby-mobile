import {
  encryptWithDetail,
  decryptWithDetail,
} from '@metamask/browser-passworder';

/**
 * Encrypt data with password
 * @param param - The encryption parameters
 * @param param.data - data to be encrypted
 * @param param.password - password for encryption
 * @returns The encrypted vault data
 */
export const passwordEncrypt = async ({
  data,
  password,
}: {
  data: any;
  password: string;
}) => {
  const { vault } = await encryptWithDetail(password, data);

  return vault;
};

/**
 * Decrypt data with password
 * @param param - The decryption parameters
 * @param param.encryptedData - encrypted data, should be a string
 * @param param.password - password for decryption
 * @returns The decrypted vault data
 */
export const passwordDecrypt = async ({
  encryptedData,
  password,
}: {
  encryptedData: string;
  password: string;
}) => {
  const { vault } = await decryptWithDetail(password, encryptedData);

  return vault as any;
};
