import {
  CreateParams,
  EVENT_NAMES,
  MODAL_ID,
  MODAL_NAMES,
  RemoveParams,
} from '@/components2024/GlobalBottomSheetModal/types';
import { uniqueId } from 'lodash';

import { sleep } from '@/utils/async';
import { globalSheetModalEvents } from '@/components2024/GlobalBottomSheetModal/event';

const createGlobalBottomSheetModal = <T extends MODAL_NAMES = MODAL_NAMES>(
  params: CreateParams<T>,
) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId(`gBm_`)}` as MODAL_ID;
  globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, params);

  return id as MODAL_ID;
};

async function removeGlobalBottomSheetModal(
  id?: MODAL_ID | null,
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

const presentGlobalBottomSheetModal = (key: MODAL_ID) => {
  globalSheetModalEvents.emit(EVENT_NAMES.PRESENT, key);
};

let removeAllFn: ((params?: RemoveParams) => void) | null = null;

const removeAllGlobalBottomSheetModals = (
  params?: RemoveParams & {
    waitMaxtime?: number;
  },
) => {
  if (!removeAllFn) {
    removeAllFn =
      require('@/components2024/GlobalBottomSheetModal/GlobalBottomSheetModal').removeAllGlobalBottomSheetModals;
  }

  if (removeAllFn) {
    const { waitMaxtime, ...removeParams } = params || {};
    removeAllFn(removeParams);
  }
};

export const apisAppWin2024 = {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  removeAllGlobalBottomSheetModals,
  globalBottomSheetModalAddListener,
  presentGlobalBottomSheetModal,
};
