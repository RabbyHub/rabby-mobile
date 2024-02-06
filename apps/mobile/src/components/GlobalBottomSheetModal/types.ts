import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';

export enum MODAL_NAMES {
  'APPROVAL' = 'APPROVAL',
  // 'WALLET_CONNECT' = 'WALLET_CONNECT',
  'SWITCH_ADDRESS' = 'SWITCH_ADDRESS',
  'SWITCH_CHAIN' = 'SWITCH_CHAIN',
  'CANCEL_CONNECT' = 'CANCEL_CONNECT',
  'CANCEL_APPROVAL' = 'CANCEL_APPROVAL',
  'SELECT_CHAIN' = 'SELECT_CHAIN',
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

export type CreateParams = {
  name: MODAL_NAMES;
  approvalComponent?: APPROVAL_MODAL_NAMES;
  onCancel?: () => void;
  bottomSheetModalProps?: Partial<BottomSheetModalProps>;
  /**
   * @description by default, every global modal instance will prevent the hardware back button on android,
   * @default false
   */
  allowAndroidHarewareBack?: boolean;
  [key: string]: any;
};

export enum EVENT_NAMES {
  CREATE = 'CREATE',
  REMOVE = 'REMOVE',
  DISMISS = 'DISMISS',
  PRESENT = 'PRESENT',
  SNAP_TO_INDEX = 'SNAP_TO_INDEX',
}
