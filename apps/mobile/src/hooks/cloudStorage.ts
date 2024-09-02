import React from 'react';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';
import { CloudStorage } from 'react-native-cloud-storage';
import { atom, useAtom, useSetAtom } from 'jotai';
import { loginIfNeeded } from '@/core/utils/cloudBackup';

const cloudStorageAtom = atom<{
  googleUser: User | null;
}>({
  googleUser: null,
});
export function useGoogleSign() {
  const [{ googleUser }, setCloudStorage] = useAtom(cloudStorageAtom);

  const previousSigned = React.useMemo(
    () => GoogleSignin.hasPreviousSignIn(),
    [],
  );

  const doGoogleSign = React.useCallback(async () => {
    let userInfo: User | null = null;
    const result = await loginIfNeeded();

    userInfo = result.userInfo ? result.userInfo : null;

    setCloudStorage(prev => ({
      ...prev,
      googleUser: userInfo,
    }));

    return result;
  }, [setCloudStorage]);

  const doGoogleSignOut = React.useCallback(async () => {
    await GoogleSignin.signOut();
    if (googleUser?.idToken) {
      await GoogleSignin.clearCachedAccessToken(googleUser?.idToken);
    }

    setCloudStorage(prev => ({
      ...prev,
      googleUser: null,
    }));
  }, [setCloudStorage, googleUser]);

  return {
    isLoginedGoogle: googleUser !== null,
    previousSigned,
    // googleUser,
    // googleUserAccessToken: googleUser?.idToken,
    doGoogleSign,
    doGoogleSignOut,
  };
}

export function useAutoGoogleSignIfPreviousSignedOnTop() {
  const setCloudStorage = useSetAtom(cloudStorageAtom);

  React.useEffect(() => {
    if (GoogleSignin.hasPreviousSignIn()) {
      GoogleSignin.signInSilently().then(userInfo => {
        setCloudStorage(prev => ({
          ...prev,
          googleUser: userInfo,
        }));
      });
    }
  }, [setCloudStorage]);
}
