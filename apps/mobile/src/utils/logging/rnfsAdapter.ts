import RNFS from 'react-native-fs';
import type { LoggingFileSystemAdapter } from '@rabby-wallet/rabby-logger';

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
