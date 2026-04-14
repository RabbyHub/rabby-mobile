import { IS_E2E_SILENT_LOGS } from '@/constant/env';
import { appMMKV } from '@/core/storage/mmkvInstances';

const EXPERIMENTAL_SETTINGS_KEY = '@ExperimentalSettings';
const SILENT_DEV_LOGS_KEY = 'silenceDevLogsForE2E';

export function getE2ESilentLogsEnabled() {
  if (IS_E2E_SILENT_LOGS) {
    return true;
  }

  const raw = appMMKV.getString(EXPERIMENTAL_SETTINGS_KEY);
  if (!raw) {
    return __DEV__;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.[SILENT_DEV_LOGS_KEY] === true;
  } catch {
    return __DEV__;
  }
}
