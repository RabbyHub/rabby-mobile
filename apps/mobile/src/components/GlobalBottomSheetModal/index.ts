import { EVENT_NAMES } from './types';
import { globalSheetModalEvents } from './event';
import { apisAppWin } from '@/core/serviceApi/appWin';
import { bindKeyringEventAfterRegistration } from '@/core/serviceApi/keyring';
import { uiRefreshTimeout } from '@/core/apis/autoLock';

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
globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
  allIds.add(id);
});
globalSheetModalEvents.on(EVENT_NAMES.REMOVE, id => {
  allIds.delete(id);
});
bindKeyringEventAfterRegistration('lock', () => {
  allIds.forEach(id => {
    apisAppWin.removeGlobalBottomSheetModal(id, { waitMaxtime: 0 });
  });
});

export const createGlobalBottomSheetModal =
  apisAppWin.createGlobalBottomSheetModal;
export const removeGlobalBottomSheetModal =
  apisAppWin.removeGlobalBottomSheetModal;
export const globalBottomSheetModalAddListener =
  apisAppWin.globalBottomSheetModalAddListener;
export const presentGlobalBottomSheetModal =
  apisAppWin.presentGlobalBottomSheetModal;

export const snapToIndexGlobalBottomSheetModal = (
  key: string,
  index: number,
) => {
  globalSheetModalEvents.emit(EVENT_NAMES.SNAP_TO_INDEX, key, index);
};
