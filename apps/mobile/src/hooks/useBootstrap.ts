import React from 'react';
import { atom, useAtom, useAtomValue } from "jotai";
import { apisBoot } from '@/core/apis';

const bootstrapAtom = atom({
  appInitialized: false,
  useBuiltinPwd: false,
});

export function useIfUseBuiltinPwd () {
  return useAtomValue(bootstrapAtom).useBuiltinPwd;
}

export function useBootstrapApp () {
  const [ {
    appInitialized,
  }, setBootstrap ] = useAtom(bootstrapAtom);

  React.useEffect(() => {
    apisBoot.tryAutoUnlockRabbyMobile()
      .then(result => {
        setBootstrap(prev => ({
          ...prev,
          useBuiltinPwd: result.useBuiltInPwd,
          appInitialized: true,
        }));
      })
      .catch((err) => {
        console.error('useBootstrapApp::', err);
        setBootstrap(prev => ({
          ...prev,
          appInitialized: true,
        }));
      });
  }, []);

  return {
    couldRender: appInitialized,
  }
}
