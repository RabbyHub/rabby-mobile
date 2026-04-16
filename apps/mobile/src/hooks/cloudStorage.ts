import React from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { atom, useAtom, useSetAtom } from 'jotai';
import { loginIfNeeded } from '@/core/utils/cloudBackup';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type CloudStorageState = {
  accessToken?: string;
};
// const cloudStorageAtom = atom<{
//   accessToken?: string;
// }>({});
const cloudStorageStore = zCreate<CloudStorageState>(() => ({
  accessToken: undefined,
}));
function setCloudStorage(valOrFunc: UpdaterOrPartials<CloudStorageState>) {
  cloudStorageStore.setState(prev => {
    const val = resolveValFromUpdater(prev, valOrFunc);

    return {
      ...prev,
      ...val.newVal,
    };
  });
}
export function useGoogleSign() {
  const cloudStorage = cloudStorageStore(state => state);

  const previousSigned = React.useMemo(
    () => GoogleSignin.hasPreviousSignIn(),
    [],
  );

  const doGoogleSign = React.useCallback(async () => {
    let accessToken: string | undefined;
    const result = await loginIfNeeded();

    accessToken = result.accessToken ? result.accessToken : undefined;

    setCloudStorage(prev => ({
      ...prev,
      accessToken,
    }));

    return result;
  }, []);

  const doGoogleSignOut = React.useCallback(async () => {
    await GoogleSignin.signOut();
    if (cloudStorage.accessToken) {
      await GoogleSignin.clearCachedAccessToken(cloudStorage.accessToken);
    }

    setCloudStorage(prev => ({
      ...prev,
      accessToken: undefined,
    }));
  }, [cloudStorage]);

  return {
    isLoginedGoogle: !!cloudStorage.accessToken,
    previousSigned,
    // googleUser,
    // googleUserAccessToken: googleUser?.idToken,
    doGoogleSign,
    doGoogleSignOut,
  };
}

export function autoGoogleSignIfPreviousSignedOnBoot() {
  if (GoogleSignin.hasPreviousSignIn()) {
    GoogleSignin.signInSilently().then(() => {
      GoogleSignin.getTokens().then(({ accessToken }) => {
        setCloudStorage(prev => ({
          ...prev,
          accessToken,
        }));
      });
    });
  }
}
