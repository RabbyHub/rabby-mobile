import {
  CreateParams,
  EVENT_NAMES,
  MODAL_NAMES,
  RemoveParams,
} from '@/components/GlobalBottomSheetModal/types';
import { uniqueId } from 'lodash';

import { sleep } from '@/utils/async';
import { globalSheetModalEvents } from '@/components/GlobalBottomSheetModal/event';

/**
 * @deprecated
 * @see file:///./../services2024/appWin.ts createGlobalBottomSheetModal
 */
const createGlobalBottomSheetModal = <T extends MODAL_NAMES = MODAL_NAMES>(
  params: CreateParams<T>,
) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId(`gBm_`)}`;
  globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, params);

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
