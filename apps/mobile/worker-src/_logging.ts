import { AppState, Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';
import {
  AppLogger,
  RollingTextLogWriter,
  type ConsoleLike,
  type LoggingFileSystemAdapter,
  type RollingTextArchiveAdapter,
} from '@rabby-wallet/rabby-logger';

const WORKER_LOG_LABEL = '[AssetWorker]';
const WORKER_LOG_ARCHIVE_PREFIX = 'rabby-mobile-asset-worker-logs';
const WORKER_LOG_ROOT_PATH = `${RNFS.DocumentDirectoryPath}/applogs`;
const WORKER_LOG_MAX_ARCHIVED_BYTES = 32 * 1024 * 1024;
const WORKER_RUNTIME_ENV = __DEV__
  ? 'development'
  : process.env.RABBY_MOBILE_BUILD_ENV === 'production'
  ? 'production'
  : 'regression';

let fileLoggingEnabled = __DEV__;
let consoleCaptureEnabled = __DEV__;

const workerLoggingFs: LoggingFileSystemAdapter = {
  mkdir(path) {
    return RNFS.mkdir(path, { NSURLIsExcludedFromBackupKey: true });
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
        mtimeMs: item.mtime?.getTime(),
      }));
  },
  unlink(path) {
    return RNFS.unlink(path);
  },
};

const workerArchiveAdapter: RollingTextArchiveAdapter | undefined =
  typeof RNFS.createZipArchive === 'function'
    ? {
        async createZipArchive({ targetPath, entries, compressionLevel }) {
          await RNFS.createZipArchive(targetPath, entries, {
            compressionLevel,
          });
        },
      }
    : undefined;

const workerLogWriter = new RollingTextLogWriter({
  fs: workerLoggingFs,
  rootDir: WORKER_LOG_ROOT_PATH,
  archivePrefix: WORKER_LOG_ARCHIVE_PREFIX,
  archiveAdapter: workerArchiveAdapter,
  maxArchivedBytes: WORKER_LOG_MAX_ARCHIVED_BYTES,
});

export const workerLogger = new AppLogger({
  runtimeEnv: WORKER_RUNTIME_ENV,
  platform: `${Platform.OS}:asset-worker`,
  writer: workerLogWriter,
  shouldWriteToFile: () => fileLoggingEnabled,
  shouldCaptureConsole: () => consoleCaptureEnabled,
});

workerLogger.installConsoleCapture(console as unknown as ConsoleLike);

function installWorkerConsoleLabel() {
  const log = console.log.bind(console);
  const info = console.info.bind(console);
  const warn = console.warn.bind(console);
  const error = console.error.bind(console);
  const debug = console.debug.bind(console);
  const trace = console.trace.bind(console);

  console.log = (...args) => log(WORKER_LOG_LABEL, ...args);
  console.info = (...args) => info(WORKER_LOG_LABEL, ...args);
  console.warn = (...args) => warn(WORKER_LOG_LABEL, ...args);
  console.error = (...args) => error(WORKER_LOG_LABEL, ...args);
  console.debug = (...args) => debug(WORKER_LOG_LABEL, ...args);
  console.trace = (...args) => trace(WORKER_LOG_LABEL, ...args);
}

installWorkerConsoleLabel();

export async function configureWorkerLogging(options: {
  captureConsole: boolean;
  writeToFile: boolean;
}) {
  fileLoggingEnabled = options.writeToFile;
  consoleCaptureEnabled = options.captureConsole;
  await workerLogger.handlePolicyChange();

  return getWorkerLoggingState();
}

export function getWorkerLoggingState() {
  return {
    archivePrefix: WORKER_LOG_ARCHIVE_PREFIX,
    captureConsole: consoleCaptureEnabled,
    writeToFile: fileLoggingEnabled,
  };
}

export async function finalizeWorkerLogArchive() {
  await workerLogger.flush();
  return workerLogger.finalizeArchive();
}

AppState.addEventListener('change', nextState => {
  void workerLogger.handleAppStateChange(nextState);
});
