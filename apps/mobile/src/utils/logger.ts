import { Platform } from 'react-native';
import { AppLogger, RollingTextLogWriter } from '@rabby-wallet/rabby-logger';
import debugLogService from '@/core/utils/debugLogService';
import { APP_DOCUMENT_LIKE_PATH } from '@/core/utils/appFS';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant';
import {
  rnfsLoggingAdapter,
  rnfsLoggingArchiveAdapter,
} from './logging/rnfsAdapter';
import {
  getEffectiveConsoleCaptureEnabled,
  getEffectiveFileLoggingEnabled,
} from './logging/settings';

export const APP_LOG_ROOT_PATH = `${APP_DOCUMENT_LIKE_PATH}/applogs`;

const logWriter = new RollingTextLogWriter({
  fs: rnfsLoggingAdapter,
  rootDir: APP_LOG_ROOT_PATH,
  archivePrefix: 'rabby-mobile-logs',
  archiveAdapter: rnfsLoggingArchiveAdapter,
});

export const logger = new AppLogger({
  runtimeEnv: APP_RUNTIME_ENV,
  platform: Platform.OS,
  writer: logWriter,
  shouldWriteToFile: getEffectiveFileLoggingEnabled,
  shouldCaptureConsole: getEffectiveConsoleCaptureEnabled,
  captureInMemory: isNonPublicProductionEnv || APP_RUNTIME_ENV !== 'production',
  onInMemoryLog(entry) {
    debugLogService.addLog(entry.message, entry.level, entry.data);
  },
});

export const devLog = (key: string, ...info: any[]) => {
  if (!__DEV__) {
    return;
  }

  if (info.length === 0) {
    logger.debug(key);
    return;
  }

  logger.debug(`[${key}]`, ...info);
};
