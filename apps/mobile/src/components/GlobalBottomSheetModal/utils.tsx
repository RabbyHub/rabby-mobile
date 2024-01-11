import {
  APPROVAL_MODAL_NAMES,
  CreateParams,
  EVENT_NAMES,
  MODAL_NAMES,
} from './types';
import EventEmitter from 'events';
import { uniqueId } from 'lodash';
import { Approval } from '../Approval';
import { SwitchAddress } from '../CommonPopup/SwitchAddress';
import { SwitchChain } from '../CommonPopup/SwitchChain';
import { CancelConnect } from '../CommonPopup/CancelConnect';
import { CancelApproval } from '../CommonPopup/CancelApproval/CancelApproval';

export const events = new EventEmitter();

export const SNAP_POINTS: Record<MODAL_NAMES, (string | number)[]> = {
  [MODAL_NAMES.APPROVAL]: ['100%'],
  [MODAL_NAMES.CANCEL_APPROVAL]: ['80%'],
  [MODAL_NAMES.SWITCH_ADDRESS]: ['80%'],
  [MODAL_NAMES.SWITCH_CHAIN]: ['80%'],
  [MODAL_NAMES.CANCEL_CONNECT]: ['80%'],
};

export const APPROVAL_SNAP_POINTS: Record<
  APPROVAL_MODAL_NAMES,
  (string | number)[]
> = {
  [APPROVAL_MODAL_NAMES.Connect]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignText]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTypedData]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTx]: ['100%'],
  [APPROVAL_MODAL_NAMES.WatchAddressWaiting]: [360],
};

export const MODAL_VIEWS: Record<MODAL_NAMES, React.ReactNode> = {
  [MODAL_NAMES.APPROVAL]: <Approval />,
  [MODAL_NAMES.CANCEL_APPROVAL]: <CancelApproval />,
  [MODAL_NAMES.SWITCH_ADDRESS]: <SwitchAddress />,
  [MODAL_NAMES.SWITCH_CHAIN]: <SwitchChain />,
  [MODAL_NAMES.CANCEL_CONNECT]: <CancelConnect />,
};

export const createGlobalBottomSheetModal = (params: CreateParams) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId()}`;
  events.emit(EVENT_NAMES.CREATE, id, params);
  return id;
};

export const removeGlobalBottomSheetModal = (key?: string | null) => {
  if (typeof key !== 'string') {
    return;
  }
  events.emit(EVENT_NAMES.REMOVE, key);
};

export const globalBottomSheetModalAddListener = (
  eventName: 'DISMISS',
  callback: (key: string) => void,
) => {
  events.on(eventName, callback);
};

export const presentGlobalBottomSheetModal = (key: string) => {
  events.emit(EVENT_NAMES.PRESENT, key);
};
