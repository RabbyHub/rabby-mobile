/// <reference path="../global.d.ts" />

import VConsole from 'vconsole';
import { useCallback, useEffect } from 'react';

import { atom, useAtom } from 'jotai';

const vConsoleAtom = atom<VConsole | null>(null);

function setVConsoleSwithXY(x: number, y: number) {
  localStorage.setItem('vConsole_switch_x', window.innerWidth - x + '');
  localStorage.setItem('vConsole_switch_y', window.innerHeight - y + '');
}

/**
 * @description
 * @returns
 */
export function useVConsole(options: { isTop?: boolean } = {}) {
  const [vConsole, setVConsole] = useAtom(vConsoleAtom);

  useEffect(() => {
    const { isTop } = options;
    let vConsoleInst: VConsole | null = null;
    if (isTop) {
      setVConsoleSwithXY(0, 0);

      vConsoleInst = window.vConsoleInst || new VConsole();
      setVConsole(vConsole);
    }

    return () => {
      // if (vConsoleInst) {
      //   vConsoleInst.destroy();
      // }
      // if (isTop) {
      //   setVConsole(null);
      // }
    };
  }, []);

  return {
    vConsole,
  };
}

export function useSendMessageFromRNWebView() {
  const sendHello = useCallback(() => {
    if (!window.ReactNativeWebView) return;

    window.ReactNativeWebView.postMessage('Hello from React');
  }, []);

  return {
    sendHello,
  };
}
