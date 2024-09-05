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
  await makeDirIfNeeded();

  const data = {
    mnemonicEncrypted: await appEncryptor.encrypt(password, mnemonic),
    address: getAddressFromMnemonic(mnemonic, 0),
    createdAt: new Date().getTime(),
  };

  const filename = generateBackupFileName(data.address);

  console.log(`save ${REMOTE_BACKUP_WALLET_DIR}/${filename}`);

  await CloudStorage.writeFile(
    `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    JSON.stringify(data),
  );
};

export const getBackupsFromCloud = async ({
  password,
}: {
  password: string;
}) => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const filenames = await CloudStorage.readdir(REMOTE_BACKUP_WALLET_DIR);
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
        await appEncryptor.decrypt(password, encryptedData),
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
