import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

export const USER_BEHAVIOR_TRACKING_OPT_OUT_KEY =
  'userBehaviorTrackingOptOut' as const;

type TrackingPreferenceStore = {
  [USER_BEHAVIOR_TRACKING_OPT_OUT_KEY]?: boolean;
};

export type TrackingOptOutPreferenceLike =
  | TrackingPreferenceStore
  | null
  | undefined;

let userBehaviorTrackingOptOutCache: boolean | undefined;

export function resolveDefaultUserBehaviorTrackingOptOut(
  preference: TrackingOptOutPreferenceLike,
) {
  const persistedValue = preference?.[USER_BEHAVIOR_TRACKING_OPT_OUT_KEY];

  if (typeof persistedValue === 'boolean') {
    return persistedValue;
  }

  return !preference;
}

export function getStoredUserBehaviorTrackingOptOut() {
  const preference = appStorage.getItem(
    APP_STORE_NAMES.preference,
  ) as TrackingOptOutPreferenceLike;

  return resolveDefaultUserBehaviorTrackingOptOut(preference);
}

export function getUserBehaviorTrackingOptOut() {
  return (
    userBehaviorTrackingOptOutCache ?? getStoredUserBehaviorTrackingOptOut()
  );
}

export function setUserBehaviorTrackingOptOutCache(value: boolean) {
  userBehaviorTrackingOptOutCache = value;
}

export function canTrackUserBehavior() {
  return !getUserBehaviorTrackingOptOut();
}
