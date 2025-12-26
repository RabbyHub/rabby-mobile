import { ReactotronCore } from 'reactotron-core-client';
import { ReactotronReactNative } from 'reactotron-react-native';

import { makeJsEEClass } from '@/core/services/_utils';
import { type MMKV_FILE_NAMES } from '../appFS';

type CM_CTX<T = any> = { reqid: string } & T;
export type EventBusListeners = {
  __REACTOTRON_LOADED__: (ctx: { client: ReactotronReactNative }) => void;

  CM_EXECUTE_SQL: (data: CM_CTX & { sql: string }) => void;
  CM_LOG_MMKV_STORE: (
    data: CM_CTX & {
      mmkvName?: 'a' | 'app' | 'appStore' | 'k' | 'keyring' | 'keyringStore';
    },
  ) => void;
};
type Listeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: EE } =
  makeJsEEClass<EventBusListeners /*  & Listeners */>();

export const reactotronEvents = new EE();

const instanceRef = { current: null as null | ReactotronReactNative };
export async function waitTronReady() {
  return new Promise<ReactotronReactNative>(resolve => {
    if (instanceRef.current) {
      resolve(instanceRef.current);
      return;
    }
    reactotronEvents.once('__REACTOTRON_LOADED__', ({ client }) => {
      if (instanceRef.current) return;

      console.debug('[debug] waitTronReady:: client ready');
      instanceRef.current = client;
      resolve(client);
    });
  });
}

export function tryGetReadyTron() {
  return instanceRef.current || null;
}

type DisplayConfig = Parameters<ReactotronCore['display']>[0];

export const log2Reactotron = (
  reactotron: ReactotronCore,
  { name, value, preview, image, important }: Partial<DisplayConfig>,
) => {
  reactotron.display({
    name: name || 'RabbyMobile',
    value,
    preview,
    image,
    important: important ?? true,
  });
};
