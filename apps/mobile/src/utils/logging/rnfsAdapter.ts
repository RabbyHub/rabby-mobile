import RNFS from '@rabby-wallet/react-native-fs';
import type { LoggingFileSystemAdapter } from '@rabby-wallet/rabby-logger';

const isNativeByteFsAvailable = () => {
  try {
    return RNFS.isJSIAvailable();
  } catch (_error) {
    return false;
  }
};

const base64ToBytes = (contents: string) =>
  Uint8Array.from(Buffer.from(contents, 'base64'));

const bytesToBase64 = (contents: Uint8Array) =>
  Buffer.from(contents).toString('base64');

export const rnfsLoggingAdapter: LoggingFileSystemAdapter = {
  mkdir(path) {
    return RNFS.mkdir(path, {
      NSURLIsExcludedFromBackupKey: true,
    });
  },
  readFile(path, encoding) {
    return RNFS.readFile(path, encoding);
  },
  writeFile(path, contents, encoding) {
    return RNFS.writeFile(path, contents, encoding);
  },
  appendFile(path, contents, encoding) {
    return RNFS.appendFile(path, contents, encoding);
  },
  async readFileBytes(path) {
    if (isNativeByteFsAvailable()) {
      return RNFS.readFileBytes(path);
    }

    return base64ToBytes(await RNFS.readFile(path, 'base64'));
  },
  async writeFileBytes(path, contents) {
    if (isNativeByteFsAvailable()) {
      RNFS.writeFileBytes(path, contents);
      return;
    }

    return RNFS.writeFile(path, bytesToBase64(contents), 'base64');
  },
  async appendFileBytes(path, contents) {
    if (isNativeByteFsAvailable()) {
      RNFS.appendFileBytes(path, contents);
      return;
    }

    return RNFS.appendFile(path, bytesToBase64(contents), 'base64');
  },
  moveFile(from, to) {
    return RNFS.moveFile(from, to);
  },
  async listFiles(path) {
    const entries = await RNFS.readDir(path);

    return entries
      .filter(item => item.isFile())
      .map(item => ({
        name: item.name,
        path: item.path,
        size: item.size,
        mtimeMs: item.mtime ? item.mtime.getTime() : undefined,
      }));
  },
  unlink(path) {
    return RNFS.unlink(path);
  },
};
