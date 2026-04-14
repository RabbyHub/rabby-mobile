import { LogBox } from 'react-native';
import { getE2ESilentLogsEnabled } from '@/utils/e2eSilentLogs';

const noop = () => {};
const SILENCED_CONSOLE_METHODS = [
  'debug',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'table',
  'time',
  'timeEnd',
  'trace',
  'warn',
] as const;

if (__DEV__ && getE2ESilentLogsEnabled()) {
  LogBox.ignoreAllLogs(true);

  for (const method of SILENCED_CONSOLE_METHODS) {
    Object.defineProperty(console, method, {
      configurable: true,
      writable: true,
      value: noop,
    });
  }
}
