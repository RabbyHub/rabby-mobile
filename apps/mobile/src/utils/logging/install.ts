import { AppState } from 'react-native';
import { subscribeOnlineConfig } from '@/core/config/online';
import { logger } from '@/utils/logger';
import { subscribeAppLogFileSettings } from './settings';

declare global {
  var __RABBY_APP_LOGGER_INSTALLED__: boolean | undefined;
}

if (
  !(global as typeof global & { __RABBY_APP_LOGGER_INSTALLED__?: boolean })
    .__RABBY_APP_LOGGER_INSTALLED__
) {
  (
    global as typeof global & { __RABBY_APP_LOGGER_INSTALLED__?: boolean }
  ).__RABBY_APP_LOGGER_INSTALLED__ = true;

  logger.installConsoleCapture();

  subscribeAppLogFileSettings(() => {
    logger.handlePolicyChange().catch(noop);
  });

  subscribeOnlineConfig(() => {
    logger.handlePolicyChange().catch(noop);
  });

  AppState.addEventListener('change', nextState => {
    logger.handleAppStateChange(nextState).catch(noop);
  });
}

function noop() {}
