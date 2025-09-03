import { CloudStorage } from 'react-native-cloud-storage';
import { IS_ANDROID, IS_IOS } from '../native/utils';
import {
  GoogleSignin,
  SignInResponse,
  User,
} from '@react-native-google-signin/google-signin';
import { appEncryptor } from '../services/shared';
import { APPLICATION_ID, FIREBASE_WEBCLIENT_ID } from '@/constant';
import { getAddressFromMnemonic } from './mnemonic';
import { sortBy } from 'lodash';
import { devLog } from '@/utils/logger';

const REMOTE_BACKUP_WALLET_DIR = `/${APPLICATION_ID}/wallet-backups`;
const CURRENT_VERSION = 1;

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

export type BackupData = {
  mnemonicEncrypted: string;
  address: string;
  createdAt: string;
  filename: string;
  version: number;
};

export type BackupDataWithMnemonic = BackupData & {
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

  const data: Omit<BackupData, 'filename'> = {
    mnemonicEncrypted: await appEncryptor.encrypt(password, mnemonic),
    address: getAddressFromMnemonic(mnemonic, 0),
    createdAt: new Date().getTime() + '',
    version: CURRENT_VERSION,
  };

  const filename = generateBackupFileName(data.address);

  devLog(`save ${REMOTE_BACKUP_WALLET_DIR}/${filename}`);

  await CloudStorage.writeFile(
    `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    JSON.stringify(data),
  );

  return filename;
};

/**
 * decrypt files from files
 * @param param password and filenames
 * @returns backups
 */
export const decryptFiles = async ({
  password,
  files,
}: {
  password: string;
  files: BackupData[];
}) => {
  const backups: BackupDataWithMnemonic[] = [];

  for (const file of files) {
    try {
      const mnemonic = await appEncryptor.decrypt(
        password,
        file.mnemonicEncrypted,
      );
      backups.push({
        ...file,
        mnemonic,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return backups;
};

/**
 * get backups from cloud
 * @returns backups
 */
export const getBackupsFromCloud = async (targetFilenames?: string[]) => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const filenames =
    targetFilenames || (await CloudStorage.readdir(REMOTE_BACKUP_WALLET_DIR));
  if (!filenames.length) {
    return [];
  }

  const backups: BackupData[] = [];

  for (const filename of filenames) {
    if (IS_IOS) {
      const cantDownload = (await CloudStorage.downloadFile(
        `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
      )) as unknown as boolean;
      devLog('download file', cantDownload);
      if (!cantDownload) {
        throw new Error('cant download file');
      }
    }

    const encryptedData = await CloudStorage.readFile(
      `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    );
    devLog(`${REMOTE_BACKUP_WALLET_DIR}/${filename}`, encryptedData);
    try {
      const result = JSON.parse(encryptedData);
      backups.push({
        filename,
        address: result.address,
        createdAt: result.createdAt,
        mnemonicEncrypted: result.mnemonicEncrypted,
        version: result.version,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return sortBy(backups, 'createdAt');
};

export const checkTokenIsExpired = async () => {
  devLog('checkTokenIsExpired');
  try {
    await Promise.race([
      CloudStorage.exists(REMOTE_BACKUP_WALLET_DIR),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000),
      ),
    ]);
    return false;
  } catch (e) {
    console.error(e);
    return true;
  }
};

export const detectCloudIsAvailable = async () => {
  if (!IS_IOS) {
    return true;
  }
  const available = await CloudStorage.isCloudAvailable();
  devLog('detectCloudIsAvailable', available);
  return available;
};

// login to google if needed
export const loginIfNeeded = async () => {
  GoogleSignin.configure({
    // https://rnfirebase.io/auth/social-auth#google
    webClientId: FIREBASE_WEBCLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  });

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

  let userInfo: User | SignInResponse | null = null;
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
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
  } catch (e) {
    console.error('login error', e);
  }

  let loopCount = 0;
  while ((await checkTokenIsExpired()) && loopCount < 3) {
    devLog('refreshAccessToken');
    result.accessToken = '';
    try {
      result.accessToken = await refreshAccessToken();
    } catch (e) {
      console.error('refreshAccessToken error', e);
    }
    loopCount++;
  }

  devLog('loginIfNeeded', result);
  if (!result.accessToken) {
    throw new Error('login failed');
  }

  return result;
};

export const makeDirIfNeeded = async () => {
  devLog('check dir', REMOTE_BACKUP_WALLET_DIR);
  if (!(await CloudStorage.exists(REMOTE_BACKUP_WALLET_DIR))) {
    const dirs = REMOTE_BACKUP_WALLET_DIR.split('/');
    let currentDir = '';
    for (const dir of dirs) {
      if (!dir) {
        continue;
      }
      currentDir += '/' + dir;
      devLog('make dir', currentDir);
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

  const accountToken = await (await GoogleSignin.getTokens()).accessToken;
  CloudStorage.setGoogleDriveAccessToken(accountToken);
  return accountToken;
};
