import { CreateParams, EVENT_NAMES, MODAL_NAMES, RemoveParams } from './types';
import { uniqueId } from 'lodash';
import { events } from './event';
import { sleep } from '@/utils/async';

export const createGlobalBottomSheetModal = <
  T extends MODAL_NAMES = MODAL_NAMES,
>(
  params: CreateParams<T>,
) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId()}`;
  events.emit(EVENT_NAMES.CREATE, id, params);
  return id;
};

export async function removeGlobalBottomSheetModal(
  key?: string | null,
  params?: RemoveParams & {
    waitMaxtime?: number;
  },
) {
  if (typeof key !== 'string') {
    return;
  }
  const { waitMaxtime, ...removeParams } = params ?? {};
  const promise = new Promise<string | null>(resolve => {
    events.once(EVENT_NAMES.CLOSED, () => {
      resolve(key);
    });
  });
  events.emit(EVENT_NAMES.REMOVE, key, removeParams);

  return Promise.all([promise, waitMaxtime ? sleep(waitMaxtime) : null]).then(
    ([r]) => r,
  );
}

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

export const presentGlobalBottomSheetModal = (key: string) => {
  events.emit(EVENT_NAMES.PRESENT, key);
};

export const snapToIndexGlobalBottomSheetModal = (
  key: string,
  index: number,
) => {
  events.emit(EVENT_NAMES.SNAP_TO_INDEX, key, index);
};
