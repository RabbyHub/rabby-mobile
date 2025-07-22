import { atom, useAtomValue } from 'jotai';
import { AppState, AppStateStatus } from 'react-native';

const PING_URL = 'https://app-api.rabby.io/ping';

async function checkNetwork(): Promise<boolean> {
  try {
    const resp = await fetch(PING_URL, { method: 'GET' });
    return resp.status === 200;
  } catch (e) {
    return false;
  }
}

const networkStatusAtom = atom(false); // false: 有网, true: 断网

let timer: NodeJS.Timeout | null = null;
let started = false;

function startNetworkPolling(set: (v: boolean) => void) {
  if (started) {
    return;
  }
  started = true;
  let lastStatus = false;
  const poll = async () => {
    const isDisconnected = !(await checkNetwork());
    if (isDisconnected !== lastStatus) {
      set(isDisconnected);
      lastStatus = isDisconnected;
    }
    const nextInterval = isDisconnected ? 2000 : 10000;
    timer = setTimeout(poll, nextInterval);
  };
  poll();
}

let appStateListener: any = null;

networkStatusAtom.onMount = set => {
  let currentAppState = AppState.currentState;

  function handleAppStateChange(nextAppState: string) {
    if (nextAppState === 'active') {
      // 回到前台，重新检测
      startNetworkPolling(set);
    } else if (nextAppState.match(/inactive|background/)) {
      // 进入后台，停止检测并设为有网
      if (timer) {
        clearTimeout(timer);
      }
      started = false;
      set(false);
    }
    currentAppState = nextAppState as AppStateStatus;
  }

  appStateListener = AppState.addEventListener('change', handleAppStateChange);

  // focus 时初始启动
  if (currentAppState === 'active') {
    startNetworkPolling(set);
  }

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    started = false;
    if (appStateListener) {
      appStateListener.remove();
    }
  };
};

export const useGlobalStatus = () => {
  const isDisConnect = useAtomValue(networkStatusAtom);
  return { isDisConnect };
};
