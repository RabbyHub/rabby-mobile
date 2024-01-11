export enum MODAL_NAMES {
  'APPROVAL' = 'APPROVAL',
  // 'WALLET_CONNECT' = 'WALLET_CONNECT',
  'SWITCH_ADDRESS' = 'SWITCH_ADDRESS',
  'SWITCH_CHAIN' = 'SWITCH_CHAIN',
  'CANCEL_CONNECT' = 'CANCEL_CONNECT',
  'CANCEL_APPROVAL' = 'CANCEL_APPROVAL',
  'SELECT_CHAIN' = 'SELECT_CHAIN',
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
  [key: string]: any;
};

export enum EVENT_NAMES {
  CREATE = 'CREATE',
  REMOVE = 'REMOVE',
  DISMISS = 'DISMISS',
  PRESENT = 'PRESENT',
}
