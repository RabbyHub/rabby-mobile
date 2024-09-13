import React from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { atom, useAtom, useSetAtom } from 'jotai';
import { loginIfNeeded } from '@/core/utils/cloudBackup';

const cloudStorageAtom = atom<{
  accessToken?: string;
}>({});
export function useGoogleSign() {
  const [cloudStorage, setCloudStorage] = useAtom(cloudStorageAtom);

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
  }, [setCloudStorage]);

  const doGoogleSignOut = React.useCallback(async () => {
    await GoogleSignin.signOut();
    if (cloudStorage.accessToken) {
      await GoogleSignin.clearCachedAccessToken(cloudStorage.accessToken);
    }

    setCloudStorage(prev => ({
      ...prev,
      accessToken: undefined,
    }));
  }, [setCloudStorage, cloudStorage]);

  return {
    isLoginedGoogle: !!cloudStorage.accessToken,
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
      GoogleSignin.signInSilently().then(() => {
        GoogleSignin.getTokens().then(({ accessToken }) => {
          setCloudStorage(prev => ({
            ...prev,
            accessToken,
          }));
        });
      });
    }
  }, [setCloudStorage]);
}
