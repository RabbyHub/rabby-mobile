import {
  CreateParams,
  EVENT_NAMES,
  MODAL_NAMES,
  RemoveParams,
} from '@/components/GlobalBottomSheetModal/types';
import { uniqueId } from 'lodash';

import { sleep } from '@/utils/async';
import { globalSheetModalEvents } from '@/components/GlobalBottomSheetModal/event';
import { makeGlobalBottomSheetSingletonRegistry } from './globalBottomSheetSingleton';

const globalBottomSheetSingletonRegistry =
  makeGlobalBottomSheetSingletonRegistry<string>();

globalSheetModalEvents.on(EVENT_NAMES.REMOVE, id => {
  globalBottomSheetSingletonRegistry.releaseId(id);
});

globalSheetModalEvents.on(EVENT_NAMES.DISMISS, id => {
  globalBottomSheetSingletonRegistry.releaseId(id);
});

/**
 * @deprecated
 * @see file:///./../services2024/appWin.ts createGlobalBottomSheetModal
 */
const createGlobalBottomSheetModal = <T extends MODAL_NAMES = MODAL_NAMES>(
  params: CreateParams<T>,
) => {
  const nextParams = {
    ...params,
    name: params.name ?? MODAL_NAMES.APPROVAL,
  };
  const activeId = globalBottomSheetSingletonRegistry.getActiveId(nextParams);
  if (activeId) {
    globalSheetModalEvents.emit(EVENT_NAMES.PRESENT, activeId);
    return activeId;
  }

  const id = `${nextParams.name}_${uniqueId(`gBm_`)}`;
  globalBottomSheetSingletonRegistry.bindActiveId(id, nextParams);
  globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, nextParams);

  return id;
};

/**
 * @deprecated
 */
async function removeGlobalBottomSheetModal(
  id?: string | null,
  params?: RemoveParams & {
    waitMaxtime?: number;
  },
) {
  if (typeof id !== 'string') {
    return;
  }
  const { waitMaxtime, ...removeParams } = params ?? {};
  const promise = new Promise<string | null>(resolve => {
    const handler = (closedId: string) => {
      if (closedId === id) {
        resolve(id);
      }
    };
    globalSheetModalEvents.once(EVENT_NAMES.CLOSED, handler);
  });
  globalSheetModalEvents.emit(EVENT_NAMES.REMOVE, id, removeParams);

  return waitMaxtime ? Promise.all([promise, sleep(waitMaxtime)]) : promise;
}

/**
 * @deprecated
 */
const globalBottomSheetModalAddListener = (
  eventName: EVENT_NAMES.DISMISS /*  | EVENT_NAMES.CLOSED */,
  callback: (key: string) => void,
  once?: boolean,
) => {
  if (once) {
    globalSheetModalEvents.once(eventName, callback);
    return;
  }
  globalSheetModalEvents.on(eventName, callback);
};

/**
 * @deprecated
 */
const presentGlobalBottomSheetModal = (key: string) => {
  globalSheetModalEvents.emit(EVENT_NAMES.PRESENT, key);
};

/**
 * @deprecated
 */
export const apisAppWin = {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  globalBottomSheetModalAddListener,
  presentGlobalBottomSheetModal,
};
