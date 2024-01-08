import * as React from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { apisBoot } from '@/core/apis';
import { keyringService } from '@/core/services';
import { initApis } from '@/core/apis/init';
import { initServices } from '@/core/services/init';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';
import { JS_LOAD_V_CONSOLE } from '@/core/bridges/builtInScripts/loadVConsole';

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
  }, [appInitialized, locked]);

  return { locked };
}

const loadEntryScriptWeb3Atom = atom('');
export function useJavaScriptBeforeContentLoaded(options?: {
  isTop?: boolean;
}) {
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

  const fullScript = React.useMemo(() => {
    return __DEV__
      ? [entryScriptWeb3, JS_LOAD_V_CONSOLE].join('\n')
      : entryScriptWeb3;
  }, [entryScriptWeb3]);

  return {
    entryScriptWeb3Loaded: appInitialized && !!entryScriptWeb3,
    entryScriptWeb3,
    fullScript: fullScript,
  };
}

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp() {
  const [{ appInitialized }, setBootstrap] = useAtom(bootstrapAtom);
  useJavaScriptBeforeContentLoaded({ isTop: true });

  React.useEffect(() => {
    apisBoot
      .tryAutoUnlockRabbyMobile()
      .then(async result => {
        setBootstrap(prev => ({
          ...prev,
          useBuiltinPwd: result.useBuiltInPwd,
          appInitialized: true,
        }));
        await initServices();
        await initApis();
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
