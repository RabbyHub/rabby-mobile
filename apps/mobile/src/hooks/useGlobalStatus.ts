import { AppState } from 'react-native';

import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

const PING_URL = 'https://app-api.rabby.io/ping';

async function checkNetwork(): Promise<boolean> {
  const appState = AppState.currentState;
  if (appState !== 'active') {
    return true;
  }
  try {
    const resp = await fetch(PING_URL, { method: 'GET' });
    return resp.status === 200;
  } catch (e) {
    return false;
  }
}

const networkStatusState = zCreate<{ isDisconnected: boolean }>(() => ({
  isDisconnected: false,
}));

runIIFEFunc(() => {
  startNetworkPolling();
});

function setNetworkStatus(valOrFunc: UpdaterOrPartials<boolean>) {
  networkStatusState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.isDisconnected,
      valOrFunc,
      { strict: true },
    );
    if (!changed) {
      return prev;
    }
    return {
      ...prev,
      isDisconnected: newVal,
    };
  });
}

let timer: NodeJS.Timeout | null = null;
let started = false;

function startNetworkPolling() {
  if (started) {
    return;
  }
  started = true;

  let lastStatus = false;
  const poll = async () => {
    const isDisconnected = !(await checkNetwork());
    if (isDisconnected !== lastStatus) {
      setNetworkStatus(isDisconnected);
      lastStatus = isDisconnected;
    }
    const nextInterval = isDisconnected ? 2000 : 10000;
    timer = setTimeout(poll, nextInterval);
  };
  poll();
}

export const useGlobalStatus = () => {
  const isDisConnect = networkStatusState(useShallow(s => s.isDisconnected));

  return { isDisConnect };
};
