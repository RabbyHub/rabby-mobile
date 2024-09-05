import { CloudStorage, CloudStorageScope } from 'react-native-cloud-storage';
import { IS_ANDROID, IS_IOS } from '../native/utils';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';
import { appEncryptor } from '../services/shared';
import { FIREBASE_WEBCLIENT_ID } from '@/constant';
import { getAddressFromMnemonic } from './mnemonic';

const REMOTE_BACKUP_WALLET_DIR = '/com.debank.rabby-mobile/wallet-backups';

GoogleSignin.configure({
  // https://rnfirebase.io/auth/social-auth#google
  webClientId: FIREBASE_WEBCLIENT_ID,
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
});

export function normalizeAndroidBackupFilename(filename: string) {
  return filename.replace(`${REMOTE_BACKUP_WALLET_DIR}/`, '');
}

const generateBackupFileName = (name: string) => {
  return name;
};

// for dev
export const deleteAllBackups = async () => {
  const files = await CloudStorage.readdir(REMOTE_BACKUP_WALLET_DIR);
  if (files.length) {
    for (const file of files) {
      await CloudStorage.unlink(`${REMOTE_BACKUP_WALLET_DIR}/${file}`);
    }
  }
};

export type BackupStats = {
  address: string;
  createdAt: string;
  filename: string;
};

export type BackupData = {
  mnemonicEncrypted: string;
  address: string;
  createdAt: string;
};

export type BackupDataWithMnemonic = BackupStats & {
  mnemonic: string;
};

/**
 * save mnemonic to cloud
 * @param param mnemonic and password
 * @returns filename
 */
export const saveMnemonicToCloud = async ({
  mnemonic,
  password,
}: {
  mnemonic: string;
  password: string;
}) => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const data: BackupData = {
    mnemonicEncrypted: await appEncryptor.encrypt(password, mnemonic),
    address: getAddressFromMnemonic(mnemonic, 0),
    createdAt: new Date().getTime() + '',
  };

  const filename = generateBackupFileName(data.address);

  console.log(`save ${REMOTE_BACKUP_WALLET_DIR}/${filename}`);

  await CloudStorage.writeFile(
    `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    JSON.stringify(data),
  );

  return filename;
};

/**
 * get backups from cloud
 * @param param password and filenames
 * @returns backups
 */
export const getBackupsFromCloud = async ({
  password,
  filenames,
}: {
  password: string;
  filenames: string[];
}) => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const backups: BackupDataWithMnemonic[] = [];

  for (const filename of filenames) {
    const json = await CloudStorage.readFile(
      `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    );
    try {
      const data = JSON.parse(json) as BackupData;
      const mnemonic = await appEncryptor.decrypt(
        password,
        data.mnemonicEncrypted,
      );
      backups.push({
        createdAt: data.createdAt,
        address: data.address,
        mnemonic,
        filename,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return backups;
};

export const getBackupsStatsFromCloud = async () => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const filenames = await CloudStorage.readdir(REMOTE_BACKUP_WALLET_DIR);
  if (!filenames.length) {
    return;
  }

  const stats: BackupStats[] = [];

  for (const filename of filenames) {
    const encryptedData = await CloudStorage.readFile(
      `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    );
    try {
      const result = JSON.parse(encryptedData);
      stats.push({
        filename,
        address: result.address,
        createdAt: result.createdAt,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return stats;
};

// login to google if needed
export const loginIfNeeded = async () => {
  const result = {
    needLogin: IS_ANDROID,
    accessToken: '',
  };
  if (!IS_ANDROID) return result;

  // // uncomment this line to force login
  // if (__DEV__ && GoogleSignin.hasPreviousSignIn()) {
  //   GoogleSignin.signOut();
  // }
  result.needLogin = true;

  // const available = await CloudStorage.isCloudAvailable();
  // console.debug('available', available);
  // if (!available) {
  //   throw new Error('Cloud is not available');
  // }

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
    try {
      userInfo = await GoogleSignin.signIn();
    } catch (error) {
      console.debug(JSON.stringify(error));
      throw error;
    }
  }

  if (userInfo) {
    const { accessToken } = await GoogleSignin.getTokens();
    // __DEV__ && console.debug('userInfo', userInfo);
    CloudStorage.setGoogleDriveAccessToken(accessToken);
    result.accessToken = accessToken;
  }

  return result;
};

export const makeDirIfNeeded = async () => {
  if (IS_IOS) {
    CloudStorage.setDefaultScope(CloudStorageScope.Documents);
  }

  console.log('check dir', REMOTE_BACKUP_WALLET_DIR);
  if (!(await CloudStorage.exists(REMOTE_BACKUP_WALLET_DIR))) {
    const dirs = REMOTE_BACKUP_WALLET_DIR.split('/');
    let currentDir = '';
    for (const dir of dirs) {
      if (!dir) {
        continue;
      }
      currentDir += '/' + dir;
      console.log('make dir', currentDir);
      if (!(await CloudStorage.exists(currentDir))) {
        await CloudStorage.mkdir(currentDir);
      }
    }
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
    ).accessToken,
  );
};
