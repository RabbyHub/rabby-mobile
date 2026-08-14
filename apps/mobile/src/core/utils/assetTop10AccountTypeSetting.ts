import { isNonPublicProductionEnv } from '@/constant';
import { appStorage } from '@/core/storage/mmkv';

const STORAGE_KEY = '@DevAssetTop10IncludeAllAccountTypes';

export function getIncludeAllAccountTypesInAssetTop10() {
  return (
    isNonPublicProductionEnv &&
    (appStorage.getItem(STORAGE_KEY) as boolean | null) === true
  );
}

export function setIncludeAllAccountTypesInAssetTop10(enabled: boolean) {
  if (!isNonPublicProductionEnv) {
    return false;
  }

  appStorage.setItem(STORAGE_KEY, enabled);
  return enabled;
}
