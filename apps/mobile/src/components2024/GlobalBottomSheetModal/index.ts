import { EVENT_NAMES, MODAL_ID } from './types';
import { globalSheetModalEvents } from './event';
import { apisAppWin2024 } from '@/core/services2024/appWin';
import { keyringService } from '@/core/services/shared';
import { uiRefreshTimeout } from '@/core/apis/autoLock';
import { debounce } from 'lodash';

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
const allIds = new IdSet<MODAL_ID>();
globalSheetModalEvents.on(EVENT_NAMES.CREATE, (id: MODAL_ID) => {
  allIds.add(id);
});
globalSheetModalEvents.on(EVENT_NAMES.REMOVE, (id: MODAL_ID) => {
  allIds.delete(id);
});
keyringService.on('lock', () => {
  allIds.forEach(id => {
    apisAppWin2024.removeGlobalBottomSheetModal(id, { waitMaxtime: 0 });
  });
});

export const createGlobalBottomSheetModal2024 = debounce(
  apisAppWin2024.createGlobalBottomSheetModal,
  200,
  {
    leading: true,
    trailing: false,
  },
) as typeof apisAppWin2024.createGlobalBottomSheetModal;
export const removeGlobalBottomSheetModal2024 =
  apisAppWin2024.removeGlobalBottomSheetModal;
export const globalBottomSheetModalAddListener2024 =
  apisAppWin2024.globalBottomSheetModalAddListener;
export const presentGlobalBottomSheetModal2024 =
  apisAppWin2024.presentGlobalBottomSheetModal;
export const removeAllGlobalBottomSheetModals2024 =
  apisAppWin2024.removeAllGlobalBottomSheetModals;

export const snapToIndexGlobalBottomSheetModal = (
  key: string,
  index: number,
) => {
  globalSheetModalEvents.emit(EVENT_NAMES.SNAP_TO_INDEX, key, index);
};
