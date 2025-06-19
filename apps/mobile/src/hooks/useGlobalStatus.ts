import { atom, useAtomValue } from 'jotai';

const PING_URL = 'https://app-api.rabby.io/ping';

async function checkNetwork(): Promise<boolean> {
  try {
    console.log('CUSTOM_LOGGER:=>: checkNetwork', 'start');
    const resp = await fetch(PING_URL, { method: 'GET' });
    console.log(
      'CUSTOM_LOGGER:=>: checkNetwork',
      'end',
      Date.now(),
      resp.status,
    );
    return resp.status === 200;
  } catch (e) {
    console.log('CUSTOM_LOGGER:=>: checkNetwork', 'error', e);
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

networkStatusAtom.onMount = set => {
  startNetworkPolling(set);
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    started = false;
  };
};

export const useGlobalStatus = () => {
  const isDisConnnect = useAtomValue(networkStatusAtom);
  console.log('CUSTOM_LOGGER:=>: isDisconnected', isDisConnnect);
  return { isDisConnnect };
};
