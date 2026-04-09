import RNFS from 'react-native-fs';
import { LoggingFileSystemAdapter } from './rollingZipWriter';

export const rnfsLoggingAdapter: LoggingFileSystemAdapter = {
  mkdir(path) {
    return RNFS.mkdir(path, {
      NSURLIsExcludedFromBackupKey: true,
    });
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
};
