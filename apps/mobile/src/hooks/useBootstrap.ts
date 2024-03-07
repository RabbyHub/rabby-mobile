import * as React from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { apisBoot } from '@/core/apis';
import { keyringService } from '@/core/services';
import { initApis } from '@/core/apis/init';
import { initServices } from '@/core/services/init';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';
import { EntryScriptVConsole } from '@/core/bridges/builtInScripts/loadVConsole';
import { JS_LOG_ON_MESSAGE } from '@/core/bridges/builtInScripts/onMessage';
import { CHAINS_LIST, syncChainList } from '@/constant/chains';
import { sleep } from '@/utils/async';

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
  }, [setLock]);

  const [{ appInitialized }] = useAtom(bootstrapAtom);
  React.useEffect(() => {
    if (!locked || !appInitialized) {
      return;
    }
  }, [appInitialized, locked]);

  return { locked };
}

const loadEntryScriptsAtom = atom({
  inPageWeb3: '',
  vConsole: '',
});
export function useJavaScriptBeforeContentLoaded(options?: {
  isTop?: boolean;
}) {
  const [{ locked }] = useAtom(lockAtom);
  const [{ appInitialized }] = useAtom(bootstrapAtom);

  const [entryScripts, setEntryScripts] = useAtom(loadEntryScriptsAtom);
  const { isTop } = options || {};

  React.useEffect(() => {
    if (!appInitialized) return;
    if (!isTop || entryScripts.inPageWeb3) return;

    Promise.allSettled([
      EntryScriptWeb3.init(),
      __DEV__ ? EntryScriptVConsole.init() : Promise.resolve(''),
    ]).then(([reqInPageWeb3, reqVConsole]) => {
      const inPageWeb3 =
        reqInPageWeb3.status === 'fulfilled' ? reqInPageWeb3.value : '';
      const vConsole =
        reqVConsole.status === 'fulfilled' ? reqVConsole.value : '';

      setEntryScripts(prev => ({ ...prev, inPageWeb3, vConsole }));
    });
  }, [isTop, appInitialized, locked, entryScripts.inPageWeb3, setEntryScripts]);

  const fullScript = React.useMemo(() => {
    return [
      entryScripts.inPageWeb3,
      __DEV__ ? entryScripts.vConsole : '',
      JS_LOG_ON_MESSAGE,
      ';true;',
    ]
      .filter(Boolean)
      .join('\n');
  }, [entryScripts.inPageWeb3, entryScripts.vConsole]);

  return {
    entryScriptWeb3Loaded: [
      appInitialized,
      !!entryScripts.inPageWeb3,
      // __DEV__ ? !!entryScripts.vConsole : true,
    ].every(x => !!x),
    entryScripts,
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
        await Promise.race([syncChainList(), sleep(5000)]);
      })
      .catch(err => {
        console.error('useBootstrapApp::', err);
        setBootstrap(prev => ({
          ...prev,
          appInitialized: true,
        }));
      });
  }, [setBootstrap]);

  return {
    couldRender: appInitialized,
  };
}
