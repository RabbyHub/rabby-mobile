import * as React from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { apisBoot, initApis } from '@/core/apis';
import { keyringService } from '@/core/services';

const bootstrapAtom = atom({
  appInitialized: false,
  useBuiltinPwd: false,
});

const lockAtom = atom({
  locked: true,
});

export function useIfUseBuiltinPwd() {
  return useAtomValue(bootstrapAtom).useBuiltinPwd;
}

/**
 * @description only call this hook on the top level component
 */
export function useInitializeAppOnTop() {
  const [{ locked }, setLock] = useAtom(lockAtom);

  React.useEffect(() => {
    const onUnlock = () => {
      setLock(prev => ({ ...prev, locked: false }));
    };
    const onLock = () => {
      setLock(prev => ({ ...prev, locked: true }));
    };
    keyringService.on('unlock', onUnlock);
    keyringService.on('lock', onLock);

    return () => {
      keyringService.off('unlock', onUnlock);
      keyringService.off('lock', onLock);
    };
  }, []);

  const [{ appInitialized }] = useAtom(bootstrapAtom);
  React.useEffect(() => {
    if (!locked || !appInitialized) {
      return;
    }

    // initApis();
  }, [appInitialized, locked]);

  return { locked };
}

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp() {
  const [{ appInitialized }, setBootstrap] = useAtom(bootstrapAtom);

  React.useEffect(() => {
    apisBoot
      .tryAutoUnlockRabbyMobile()
      .then(result => {
        setBootstrap(prev => ({
          ...prev,
          useBuiltinPwd: result.useBuiltInPwd,
          appInitialized: true,
        }));
        initApis();
      })
      .catch(err => {
        console.error('useBootstrapApp::', err);
        setBootstrap(prev => ({
          ...prev,
          appInitialized: true,
        }));
      });
  }, []);

  return {
    couldRender: appInitialized,
  };
}
