import { CloudStorage, CloudStorageScope } from 'react-native-cloud-storage';
import { IS_ANDROID } from '../native/utils';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
  User,
} from '@react-native-google-signin/google-signin';
import md5 from 'md5';
import { appEncryptor } from '../services/shared';
import { FIREBASE_WEBCLIENT_ID } from '@/constant';

const REMOTE_BACKUP_WALLET_DIR = '/com.debank.rabby-mobile/wallet-backups';

GoogleSignin.configure({
  // https://rnfirebase.io/auth/social-auth#google
  webClientId: FIREBASE_WEBCLIENT_ID,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

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
  await makeDirIfNeeded();

  const encryptedData = await appEncryptor.encrypt(
    password,
    JSON.stringify(mnemonic),
  );
  const filename = generateBackupFileName(mnemonic);

  await CloudStorage.writeFile(
    `/${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
    encryptedData,
    CloudStorageScope.Documents,
  );
};

export const getBackupsFromCloud = async ({
  password,
}: {
  password: string;
}) => {
  await loginIfNeeded();
  await makeDirIfNeeded();

  const filenames = await CloudStorage.readdir(
    REMOTE_BACKUP_WALLET_DIR,
    CloudStorageScope.Documents,
  );
  if (!filenames.length) {
    return;
  }

  const backups: string[] = [];

  for (const filename of filenames) {
    const encryptedData = await CloudStorage.readFile(
      `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
      CloudStorageScope.Documents,
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
    userInfo: null as User | null,
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
    // __DEV__ && console.debug('userInfo', userInfo);
    CloudStorage.setGoogleDriveAccessToken(userInfo.idToken);
    result.userInfo = userInfo;
  }

  return result;
};

export const makeDirIfNeeded = async () => {
  if (
    !(await CloudStorage.exists(
      REMOTE_BACKUP_WALLET_DIR,
      CloudStorageScope.Documents,
    ))
  ) {
    await CloudStorage.mkdir(
      REMOTE_BACKUP_WALLET_DIR,
      CloudStorageScope.Documents,
    );
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
