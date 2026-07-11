import { appStorage } from '@/core/storage/mmkv';

export const CONVERT_DUST_BANNER_VISITED_KEY =
  '@home.convertDustBanner.visited';

export function getConvertDustBannerVisitedSnapshot() {
  return !!(appStorage.getItem(CONVERT_DUST_BANNER_VISITED_KEY) as
    | boolean
    | null);
}
