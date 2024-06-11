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
  'CONNECT_LEDGER' = 'CONNECT_LEDGER',
  'SETTING_LEDGER' = 'SETTING_LEDGER',
  'CONNECT_KEYSTONE' = 'CONNECT_KEYSTONE',
  'SETTING_KEYSTONE' = 'SETTING_KEYSTONE',
  'CONNECT_ONEKEY' = 'CONNECT_ONEKEY',
  'SETTING_ONEKEY' = 'SETTING_ONEKEY',
  'TIP_UPGRADE' = 'TIP_UPGRADE',
  'TIP_TERM_OF_USE' = 'TIP_TERM_OF_USE',
  'ONEKEY_INPUT_PIN' = 'ONEKEY_INPUT_PIN',
  'ONEKEY_INPUT_PASSPHRASE' = 'ONEKEY_INPUT_PASSPHRASE',
  'ONEKEY_TEMP_PIN_OR_PASSPHRASE' = 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
}

export enum APPROVAL_MODAL_NAMES {
  'Connect' = 'Connect',
  'SignText' = 'SignText',
  'SignTypedData' = 'SignTypedData',
  'SignTx' = 'SignTx',
  'WatchAddressWaiting' = 'WatchAddressWaiting',
  'LedgerHardwareWaiting' = 'LedgerHardwareWaiting',
  'KeystoneHardwareWaiting' = 'KeystoneHardwareWaiting',
  'OneKeyHardwareWaiting' = 'OneKeyHardwareWaiting',
  'PrivatekeyWaiting' = 'PrivatekeyWaiting',
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
  [MODAL_NAMES.TIP_UPGRADE]: {};
};

export type CreateParams<T extends MODAL_NAMES = MODAL_NAMES> = {
  name: T;
  approvalComponent?: APPROVAL_MODAL_NAMES;
  /** @deprecated use bottomSheetModalProps.onDismiss directly */
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
