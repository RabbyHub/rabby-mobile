import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';

export enum MODAL_NAMES {
  'APPROVAL' = 'APPROVAL',
  // 'WALLET_CONNECT' = 'WALLET_CONNECT',
  'SWITCH_ADDRESS' = 'SWITCH_ADDRESS',
  'SWITCH_CHAIN' = 'SWITCH_CHAIN',
  'CANCEL_CONNECT' = 'CANCEL_CONNECT',
  'CANCEL_APPROVAL' = 'CANCEL_APPROVAL',
  'SELECT_CHAIN' = 'SELECT_CHAIN',
  'SIMPLE_CONFIRM' = 'SIMPLE_CONFIRM',
  // 'TMP_CONFIRM_VERIFY' = 'TMP_CONFIRM_VERIFY',
  'SELECT_SORTED_CHAIN' = 'SELECT_SORTED_CHAIN',
  'VIEW_RAW_DETAILS' = 'VIEW_RAW_DETAILS',
  'CANCEL_TX_POPUP' = 'CANCEL_TX_POPUP',
}

export enum APPROVAL_MODAL_NAMES {
  'Connect' = 'Connect',
  'SignText' = 'SignText',
  'SignTypedData' = 'SignTypedData',
  'SignTx' = 'SignTx',
  'WatchAddressWaiting' = 'WatchAddressWaiting',
}

export type MODAL_CREATE_PARMAS = {
  [MODAL_NAMES.APPROVAL]: {};
  [MODAL_NAMES.SWITCH_ADDRESS]: {};
  [MODAL_NAMES.SWITCH_CHAIN]: {};
  [MODAL_NAMES.CANCEL_CONNECT]: {};
  [MODAL_NAMES.CANCEL_APPROVAL]: {};
  [MODAL_NAMES.SELECT_CHAIN]: {};
  [MODAL_NAMES.SIMPLE_CONFIRM]: {
    title: string;
  };
  [MODAL_NAMES.SELECT_SORTED_CHAIN]: {};
  [MODAL_NAMES.VIEW_RAW_DETAILS]: {};
  [MODAL_NAMES.CANCEL_TX_POPUP]: {};
};

export type CreateParams<T extends MODAL_NAMES = MODAL_NAMES> = {
  name: T;
  approvalComponent?: APPROVAL_MODAL_NAMES;
  onCancel?: () => void;
  bottomSheetModalProps?: Partial<BottomSheetModalProps>;
  /**
   * @description by default, every global modal instance will prevent the hardware back button on android,
   * @default false
   */
  allowAndroidHarewareBack?: boolean;
  [key: string]: any;
} & (T extends keyof MODAL_CREATE_PARMAS ? MODAL_CREATE_PARMAS[T] : {});

export enum EVENT_NAMES {
  CREATE = 'CREATE',
  REMOVE = 'REMOVE',
  DISMISS = 'DISMISS',
  PRESENT = 'PRESENT',
  SNAP_TO_INDEX = 'SNAP_TO_INDEX',
}
