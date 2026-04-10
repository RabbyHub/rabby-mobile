import { Platform } from 'react-native';
import debugLogService from '@/core/services/debugLogService';
import { APP_DOCUMENT_LIKE_PATH } from '@/core/utils/appFS';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { AppLogger } from './logging/core';
import { rnfsLoggingAdapter } from './logging/rnfsAdapter';
import {
  getEffectiveConsoleCaptureEnabled,
  getEffectiveFileLoggingEnabled,
} from './logging/settings';
import { RollingZipLogWriter } from './logging/rollingZipWriter';

export const APP_LOG_ROOT_PATH = `${APP_DOCUMENT_LIKE_PATH}/applogs`;

const logWriter = new RollingZipLogWriter({
  fs: rnfsLoggingAdapter,
  rootDir: APP_LOG_ROOT_PATH,
  archivePrefix: 'rabby-mobile-logs',
});

export const logger = new AppLogger({
  runtimeEnv: APP_RUNTIME_ENV,
  platform: Platform.OS,
  writer: logWriter,
  shouldWriteToFile: getEffectiveFileLoggingEnabled,
  shouldCaptureConsole: getEffectiveConsoleCaptureEnabled,
  captureInMemory: APP_RUNTIME_ENV !== 'production',
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
