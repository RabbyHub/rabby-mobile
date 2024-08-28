import { nodeEncryptor } from '@rabby-wallet/service-keyring/dist/utils/encryptor';
import { CloudStorage } from 'react-native-cloud-storage';
import { IS_ANDROID } from '../native/utils';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const REMOTE_BACKUP_WALLET_DIR = 'com.debank.rabby-mobile/wallet-backups';

GoogleSignin.configure();

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
  const encryptedData = await nodeEncryptor.encrypt(
    password,
    JSON.stringify(mnemonic),
  );

  await CloudStorage.writeFile(
    `${REMOTE_BACKUP_WALLET_DIR}/mnemonic.txt`,
    encryptedData,
  );
};

// login to google if needed
export const loginIfNeeded = async () => {
  if (!IS_ANDROID) {
    return false;
  }
  const available = await CloudStorage.isCloudAvailable();

  if (available) {
    return false;
  }

  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    CloudStorage.setGoogleDriveAccessToken(userInfo.idToken);
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          // user cancelled the login flow
          break;
        case statusCodes.IN_PROGRESS:
          // operation (eg. sign in) already in progress
          break;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          // play services not available or outdated
          break;
        default:
        // some other error happened
      }
    } else {
      // an error that's not related to google sign in occurred
    }
  }
};
