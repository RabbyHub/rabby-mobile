import * as React from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { apisBoot, initApis } from '@/core/apis';
import { keyringService } from '@/core/services';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';

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

const loadEntryScriptWeb3Atom = atom('');
export function useLoadEntryScriptWeb3(options?: { isTop?: boolean }) {
  const [{ locked }] = useAtom(lockAtom);
  const [{ appInitialized }] = useAtom(bootstrapAtom);

  const [entryScriptWeb3, setEntryScriptWeb3] = useAtom(
    loadEntryScriptWeb3Atom,
  );
  const { isTop } = options || {};

  React.useEffect(() => {
    if (!isTop) {
      return;
    }
    if (entryScriptWeb3) {
      return;
    }
    if (locked || !appInitialized) {
      return;
    }

    EntryScriptWeb3.init().then(js => {
      setEntryScriptWeb3(js);
    });
  }, [isTop, appInitialized, locked, entryScriptWeb3]);

  return {
    entryScriptWeb3Loaded: appInitialized && !!entryScriptWeb3,
    entryScriptWeb3,
  };
}

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp() {
  const [{ appInitialized }, setBootstrap] = useAtom(bootstrapAtom);
  useLoadEntryScriptWeb3({ isTop: true });

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
