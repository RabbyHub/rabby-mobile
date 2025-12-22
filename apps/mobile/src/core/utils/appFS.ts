import { stringUtils } from '@rabby-wallet/base-utils';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const isIOS = Platform.OS === 'ios';
export const APP_DOCUMENT_LIKE_PATH = isIOS
  ? RNFS.DocumentDirectoryPath
  : RNFS.DocumentDirectoryPath;

export const MMKV_ROOT_PATH = isIOS
  ? `${stringUtils.unSuffix(RNFS.DocumentDirectoryPath, '/')}/mmkv`
  : // TODO: test it on Android
    `${stringUtils.unSuffix(RNFS.DocumentDirectoryPath, '/')}/mmkv`;

/**
 * @description every files will have a `.crc` file with the same name
 */
export enum MMKV_FILE_NAMES {
  DEFAULT = 'mmkv.default',
  KEYCHAIN = 'mmkv.keychain',
  KEYRING = 'mmkv.keyring',
  CHAINS = 'mmkv.chains',
  DAYCURVE = 'mmkv.24hCurve',
  CEXID = 'mmkv.cexid',
  BALANCE_24H = 'mmkv.balance24h',

  LENDING_DATA_CACHE = 'mmkv.lendingDataCache',
}

export async function walkThroughMMKVFiles(
  callback: (ctx: {
    fileBaseName: MMKV_FILE_NAMES;
    filePath: string;
    fileExist: boolean;
    crcFileBaseName: string;
    crcFilePath: string;
    crcFileExist: boolean;
  }) => void,
) {
  Object.values(MMKV_FILE_NAMES).forEach(fileBaseName => {
    const filePath = `${stringUtils.unSuffix(
      MMKV_ROOT_PATH,
      '/',
    )}/${fileBaseName}`;
    const crcFilePath = `${filePath}.crc`;

    Promise.allSettled([RNFS.exists(filePath), RNFS.exists(crcFilePath)])
      .then(([fileExistRet, crcFileExistRet]) => {
        callback({
          fileBaseName,
          filePath,
          fileExist:
            fileExistRet.status === 'fulfilled' ? fileExistRet.value : false,
          crcFileBaseName: `${fileBaseName}.crc`,
          crcFilePath,
          crcFileExist:
            crcFileExistRet.status === 'fulfilled'
              ? crcFileExistRet.value
              : false,
        });
      })
      .catch(err => {
        console.error('walkThroughMMKVFiles error: %s', err);
      });
  });
}

// // leave here for debug
// ;(function detectMMKVFilesExist() {
//   if (!isIOS || !__DEV__) return ;

//   walkThroughMMKVFiles(({ filePath, fileExist, crcFilePath, crcFileExist }) => {
//     console.debug(`mmkv file("${filePath}"): %s; its crc file("${crcFilePath}") exist: %s`, fileExist, crcFileExist);
//   });
// })();
