import { IS_E2E_SILENT_LOGS } from '@/constant/env';
import { storeApiExpSettingData } from '@/hooks/appSettings';

const SILENT_DEV_LOGS_KEY = 'silenceDevLogsForE2E';

export function getE2ESilentLogsEnabled() {
  if (IS_E2E_SILENT_LOGS) {
    return true;
  }

  return storeApiExpSettingData.get()?.[SILENT_DEV_LOGS_KEY] === true;
}
