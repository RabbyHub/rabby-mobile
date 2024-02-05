import { keyringService } from '../services';

interface CacheState {
  path: string;
  params?: Record<string, string>;
  states: Record<string, any>;
  search?: string;
}
export function hasPageStateCache() {
  return false;
  // return pageStateCacheService.has();
}

export function getPageStateCache() {
  if (!keyringService.isUnlocked()) return null;

  // return pageStateCacheService.get();
  return null;
}

export function clearPageStateCache() {
  // pageStateCacheService.clear();
}

export function setPageStateCache(cache: CacheState) {
  // pageStateCacheService.set(cache);
}
