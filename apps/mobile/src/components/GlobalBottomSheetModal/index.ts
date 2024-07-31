import { CreateParams, EVENT_NAMES, MODAL_NAMES, RemoveParams } from './types';
import { uniqueId } from 'lodash';
import { events } from './event';
import { sleep } from '@/utils/async';
import { appWinCaller, makeAsyncCallWrapper } from '@/core/services/appWin';
import { keyringService } from '@/core/services';
import { uiRefreshTimeout } from '../AutoLockView';

class IdSet<T = any> extends Set<T> {
  add(id: T) {
    uiRefreshTimeout();
    return super.add(id);
  }
  delete(id: T) {
    uiRefreshTimeout();
    return super.delete(id);
  }
}
const allIds = new IdSet<string>();
keyringService.on('lock', () => {
  allIds.forEach(id => {
    appWinCaller.removeGlobalBottomSheetModal(id, { waitMaxtime: 0 });
  });
});

export const createGlobalBottomSheetModal = <
  T extends MODAL_NAMES = MODAL_NAMES,
>(
  params: CreateParams<T>,
) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId(`gBm_`)}`;
  events.emit(EVENT_NAMES.CREATE, id, params);
  allIds.add(id);

  return id;
};
appWinCaller.on(
  'createGlobalBottomSheetModal',
  makeAsyncCallWrapper(createGlobalBottomSheetModal),
);

export async function removeGlobalBottomSheetModal(
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
    events.once(EVENT_NAMES.CLOSED, closedId => {
      if (closedId === id) {
        allIds.delete(id);
        resolve(id);
      }
    });
  });
  events.emit(EVENT_NAMES.REMOVE, id, removeParams);

  return Promise.race([promise, waitMaxtime ? sleep(waitMaxtime) : null]);
}
appWinCaller.on(
  'removeGlobalBottomSheetModal',
  makeAsyncCallWrapper(removeGlobalBottomSheetModal),
);

export const globalBottomSheetModalAddListener = (
  eventName: EVENT_NAMES.DISMISS /*  | EVENT_NAMES.CLOSED */,
  callback: (key: string) => void,
  once?: boolean,
) => {
  if (once) {
    events.once(eventName, callback);
    return;
  }
  events.on(eventName, callback);
};
appWinCaller.on(
  'globalBottomSheetModalAddListener',
  makeAsyncCallWrapper(globalBottomSheetModalAddListener),
);

export const presentGlobalBottomSheetModal = (key: string) => {
  events.emit(EVENT_NAMES.PRESENT, key);
};
appWinCaller.on(
  'presentGlobalBottomSheetModal',
  makeAsyncCallWrapper(presentGlobalBottomSheetModal),
);

export const snapToIndexGlobalBottomSheetModal = (
  key: string,
  index: number,
) => {
  events.emit(EVENT_NAMES.SNAP_TO_INDEX, key, index);
};
