import { nodeEncryptor } from '@rabby-wallet/service-keyring/dist/utils/encryptor';
import { CloudStorage } from 'react-native-cloud-storage';
import { IS_ANDROID } from '../native/utils';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
  User,
} from '@react-native-google-signin/google-signin';
import md5 from 'md5';

const REMOTE_BACKUP_WALLET_DIR = 'com.debank.rabby-mobile/wallet-backups';

GoogleSignin.configure();

const generateBackupFileName = (mnemonic: string) => {
  return md5(mnemonic);
};

// for dev
export const deleteAllBackups = async () => {
  CloudStorage.unlink(REMOTE_BACKUP_WALLET_DIR);
};

export const saveMnemonicToCloud = async ({
  mnemonic,
  password,
}: {
  mnemonic: string;
  password: string;
}) => {
  await loginIfNeeded();

  const encryptedData = await nodeEncryptor.encrypt(
    password,
    JSON.stringify(mnemonic),
  );
  const filename = generateBackupFileName(mnemonic);

  await CloudStorage.writeFile(
    `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    encryptedData,
  );
};

export const getBackupsFromCloud = async ({
  password,
}: {
  password: string;
}) => {
  await loginIfNeeded();

  const filenames = await CloudStorage.readdir(`${REMOTE_BACKUP_WALLET_DIR}`);
  if (!filenames.length) {
    return;
  }

  const backups: string[] = [];

  for (const filename of filenames) {
    const encryptedData = await CloudStorage.readFile(
      `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    );
    try {
      const result = JSON.parse(
        await nodeEncryptor.decrypt(password, encryptedData),
      );
      backups.push(result);
    } catch (e) {
      console.error(e);
    }
  }

  return backups;
};

// login to google if needed
export const loginIfNeeded = async () => {
  const available = await CloudStorage.isCloudAvailable();

  if (available) {
    throw new Error('Cloud is not available');
  }

  if (!IS_ANDROID) {
    return true;
  }

  let userInfo: User | null = null;
  await GoogleSignin.hasPlayServices();

  if (GoogleSignin.hasPreviousSignIn()) {
    userInfo = await GoogleSignin.getCurrentUser();
    if (!userInfo) {
      await GoogleSignin.signInSilently();
      userInfo = await GoogleSignin.getCurrentUser();
    }
  }

  if (!userInfo) {
    userInfo = await GoogleSignin.signIn();
  }

  if (userInfo) {
    CloudStorage.setGoogleDriveAccessToken(userInfo.idToken);
  }
};

// if token expired, refresh it
export const refreshAccessToken = async () => {
  const token = await CloudStorage.getGoogleDriveAccessToken();
  if (token) {
    await GoogleSignin.clearCachedAccessToken(token);
  }
  CloudStorage.setGoogleDriveAccessToken(
    await (
      await GoogleSignin.getTokens()
    ).idToken,
  );
};
