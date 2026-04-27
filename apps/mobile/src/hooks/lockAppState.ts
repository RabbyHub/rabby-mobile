import type { AppStateStatus } from 'react-native';

export function isAppStateInactive(appStatus: AppStateStatus) {
  return [
    'inactive',
    /* not possible for our ios app, but just write here */
    'background',
  ].includes(appStatus);
}

export function shouldTreatIosAppStateAsBackground(
  appStatus: AppStateStatus,
  hasBecomeActiveOnce: boolean,
) {
  // Cold launch on iOS can start in "inactive" before the first "active".
  // Avoid showing the global background blur during startup, while still
  // preserving the inactive-state protection after the app has foregrounded.
  return (
    appStatus === 'background' ||
    (appStatus === 'inactive' && hasBecomeActiveOnce)
  );
}
