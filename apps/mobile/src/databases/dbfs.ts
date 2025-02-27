import RNFS from 'react-native-fs';
import { getRabbyAppDbName, getRabbyAppDbPath } from './constant';
import { toast } from '@/components2024/Toast';
import { Platform, Share } from 'react-native';
import { prepareAppDataSource } from './imports';

async function walkDbFiles() {
  const dbPath = getRabbyAppDbPath();

  return Promise.allSettled([
    (await RNFS.exists(`${dbPath}`))
      ? RNFS.stat(`${dbPath}`)
      : Promise.resolve(null),
    (await RNFS.exists(`${dbPath}-shm`))
      ? RNFS.stat(`${dbPath}-shm`)
      : Promise.resolve(null),
    (await RNFS.exists(`${dbPath}-wal`))
      ? RNFS.stat(`${dbPath}-wal`)
      : Promise.resolve(null),
  ]).then(([db, dbshm, dbwal]) => {
    return {
      db: db.status === 'fulfilled' ? db.value : null,
      dbshm: dbshm && dbshm.status === 'fulfilled' ? dbshm.value : null,
      dbwal: dbwal && dbwal.status === 'fulfilled' ? dbwal.value : null,
    };
  });
}

export async function getDbFileSize() {
  const dbPath = getRabbyAppDbPath();
  if (!dbPath) {
    console.error('dbPath is not defined or empty');
    return null;
  }

  if (!(await RNFS.exists(dbPath))) {
    console.error('dbPath is not exists', __DEV__ ? dbPath : '');
    return null;
  }

  return Promise.allSettled([
    RNFS.stat(dbPath).then(info => info.size),
    (await RNFS.exists(`${dbPath}-shm`))
      ? RNFS.stat(`${dbPath}-shm`).then(info => info.size)
      : Promise.resolve(0),
    (await RNFS.exists(`${dbPath}-wal`))
      ? RNFS.stat(`${dbPath}-wal`).then(info => info.size)
      : Promise.resolve(0),
  ]).then(allInfosResult => {
    const total_bytes = allInfosResult.reduce((acc, promiseRet) => {
      if (promiseRet.status === 'fulfilled') acc += promiseRet.value;

      return acc;
    }, 0);

    return total_bytes;
  });
}

export async function removeDBFiles() {
  return walkDbFiles().then(result => {
    Promise.allSettled([
      result.db && RNFS.unlink(result.db.path),
      result.dbshm && RNFS.unlink(result.dbshm.path),
      result.dbwal && RNFS.unlink(result.dbwal.path),
    ]).then(([db, dbshm, dbwal]) => {
      if (db.status === 'fulfilled' && db.value) {
        console.debug(
          `DB file removed: ${
            db.status === 'fulfilled' ? 'success' : 'failed'
          }`,
        );
      }
      if (dbshm.status === 'fulfilled' && dbshm.value) {
        console.debug(
          `DB-SHM file removed: ${
            dbshm.status === 'fulfilled' ? 'success' : 'failed'
          }`,
        );
      }
      if (dbwal.status === 'fulfilled' && dbwal.value) {
        console.debug(
          `DB-WAL file removed: ${
            dbwal.status === 'fulfilled' ? 'success' : 'failed'
          }`,
        );
      }
    });
  });
}

function getDbPath(databaseName: string, location = 'default') {
  if (Platform.OS === 'android') {
    const docDir = RNFS.DocumentDirectoryPath;
    let basePath = docDir.substring(0, docDir.indexOf('/files'));
    return basePath + '/databases/' + databaseName;
  } else if (Platform.OS === 'ios') {
    let path;
    switch (location) {
      case 'default':
        path = RNFS.LibraryDirectoryPath + '/LocalDatabase/' + databaseName;
        break;
      case 'Library':
        path = RNFS.LibraryDirectoryPath + '/' + databaseName;
        break;
      case 'Documents':
        path = RNFS.DocumentDirectoryPath + '/' + databaseName;
        break;
      case 'Shared':
        break;
      default:
        path = RNFS.LibraryDirectoryPath + '/LocalDatabase/' + databaseName;
        break;
    }
    return path;
  }
}

export const downloadDbFile = async () => {
  const as = await prepareAppDataSource();
  try {
    await as.query('PRAGMA wal_checkpoint;');
    await as.destroy();
  } catch (error) {
    toast.show(`db close error ${String(error)}`);
  }

  const dbPath = getDbPath(getRabbyAppDbName()) || '';
  let destPath;
  if (Platform.OS === 'android') {
    destPath = RNFS.ExternalStorageDirectoryPath + '/' + getRabbyAppDbName();
  } else if (Platform.OS === 'ios') {
    destPath = RNFS.DocumentDirectoryPath + '/' + getRabbyAppDbName();
  }

  try {
    const exists = await RNFS.exists(dbPath);
    if (exists) {
      const destExists = await RNFS.exists(destPath);

      if (destExists && Platform.OS === 'ios') {
        await RNFS.unlink(destPath);
      }

      await RNFS.copyFile(dbPath, destPath);

      if (Platform.OS === 'ios') {
        await Share.share({ url: `file://${destPath}` });
      }
    } else {
      toast.show('数据库文件未找到');
    }
  } catch (error) {
    toast.show(`下载失败: ${String(error)}`);

    console.error('下载失败:', error);
  }
};
