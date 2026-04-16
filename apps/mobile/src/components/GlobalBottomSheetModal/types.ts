import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/src/types';

import type { AuthenticationModalProps } from '../AuthenticationModal/AuthenticationModal';
import type { NFTDetailPopupProps } from '@/screens/NftDetail/PopupInner';

export enum MODAL_NAMES {
  'APPROVAL' = 'APPROVAL',
  'SWITCH_ADDRESS' = 'SWITCH_ADDRESS',
  'SWITCH_CHAIN' = 'SWITCH_CHAIN',
  'CANCEL_CONNECT' = 'CANCEL_CONNECT',
  'CANCEL_APPROVAL' = 'CANCEL_APPROVAL',
  'SELECT_CHAIN' = 'SELECT_CHAIN',
  'SIMPLE_CONFIRM' = 'SIMPLE_CONFIRM',
  // 'TMP_CONFIRM_VERIFY' = 'TMP_CONFIRM_VERIFY',
  'VIEW_RAW_DETAILS' = 'VIEW_RAW_DETAILS',
  'CANCEL_TX_POPUP' = 'CANCEL_TX_POPUP',
  'CONNECT_LEDGER' = 'CONNECT_LEDGER',
  'SETTING_LEDGER' = 'SETTING_LEDGER',
  'CONNECT_KEYSTONE' = 'CONNECT_KEYSTONE',
  'SETTING_KEYSTONE' = 'SETTING_KEYSTONE',
  'CONNECT_ONEKEY' = 'CONNECT_ONEKEY',
  'SETTING_ONEKEY' = 'SETTING_ONEKEY',
  'SETTING_HDKEYRING' = 'SETTING_HDKEYRING',
  'SEED_PHRASE_BACKUP_TO_CLOUD' = 'SEED_PHRASE_BACKUP_TO_CLOUD',
  /** @deprecated */
  'SEED_PHRASE_RESTORE_FROM_CLOUD' = 'SEED_PHRASE_RESTORE_FROM_CLOUD',
  'SEED_PHRASE_BACKUP_NOT_AVAILABLE' = 'SEED_PHRASE_BACKUP_NOT_AVAILABLE',

  'TIP_UPGRADE' = 'TIP_UPGRADE',
  '__TEST_MARKDOWN_IN_WEBVIEW' = '__TEST_MARKDOWN_IN_WEBVIEW',
  'TIP_PRIVACY_POLICY' = 'TIP_PRIVACY_POLICY',
  'TIP_TERM_OF_USE' = 'TIP_TERM_OF_USE',
  'ONEKEY_INPUT_PIN' = 'ONEKEY_INPUT_PIN',
  'ONEKEY_INPUT_PASSPHRASE' = 'ONEKEY_INPUT_PASSPHRASE',
  'ONEKEY_TEMP_PIN_OR_PASSPHRASE' = 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
  'AUTHENTICATION' = 'AUTHENTICATION',
  'NFT_DETAIL' = 'NFT_DETAIL',
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
  'TrezorHardwareWaiting' = 'TrezorHardwareWaiting',
  'PrivatekeyWaiting' = 'PrivatekeyWaiting',
  'ETHSign' = 'ETHSign',
  'Unknown' = 'Unknown',
  'AddChain' = 'AddChain',
  'AddAsset' = 'AddAsset',
}

export type MODAL_CREATE_PARAMS = {
  [MODAL_NAMES.APPROVAL]: {};
  [MODAL_NAMES.SWITCH_ADDRESS]: {};
  [MODAL_NAMES.SWITCH_CHAIN]: {};
  [MODAL_NAMES.CANCEL_CONNECT]: {};
  [MODAL_NAMES.CANCEL_APPROVAL]: {};
  [MODAL_NAMES.SELECT_CHAIN]: {};
  [MODAL_NAMES.SIMPLE_CONFIRM]: {
    title: string;
  };
  [MODAL_NAMES.VIEW_RAW_DETAILS]: {};
  [MODAL_NAMES.CANCEL_TX_POPUP]: {};
  [MODAL_NAMES.TIP_UPGRADE]: {};
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: {};
  [MODAL_NAMES.AUTHENTICATION]: AuthenticationModalProps;
  [MODAL_NAMES.NFT_DETAIL]: NFTDetailPopupProps;
};

export type CreateParams<T extends MODAL_NAMES = MODAL_NAMES> = {
  name: T;
  approvalComponent?: APPROVAL_MODAL_NAMES;
  /** @deprecated use bottomSheetModalProps.onDismiss directly */
  onCancel?: () => void;
  bottomSheetModalProps?: Partial<BottomSheetModalProps> & {
    /**
     * @description by default we use BottomSheetView, but if your sub views contain scrollable content, you MUST use View as modal's inner root
     * @see https://gorhom.dev/react-native-bottom-sheet/scrollables
     * @default 'BottomSheetView'
     */
    rootViewType?: 'View' | 'BottomSheetView';
  };
  /**
   * @description by default, every global modal instance will prevent the hardware back button on android,
   * @default false
   */
  allowAndroidHarewareBack?: boolean;
  [key: string]: any;
} & (T extends keyof MODAL_CREATE_PARAMS ? MODAL_CREATE_PARAMS[T] : {});

export type GlobalModalViewProps<
  T extends MODAL_NAMES = MODAL_NAMES,
  P extends object = object,
> = CreateParams<T> & {
  $createParams: CreateParams<T>;
} & P;

export type RemoveParams = Partial<
  Parameters<BottomSheetMethods['close']>[0]
> & {
  duration?: number;
};

export enum EVENT_NAMES {
  CREATE = 'CREATE',
  REMOVE = 'REMOVE',
  DISMISS = 'DISMISS',
  CLOSED = 'CLOSED',
  PRESENT = 'PRESENT',
  PRESENTED = 'PRESENTED',
  SNAP_TO_INDEX = 'SNAP_TO_INDEX',
}

export type GlobalSheetModalListeners = {
  [EVENT_NAMES.CREATE]: (id: string, params: CreateParams) => any;
  [EVENT_NAMES.REMOVE]: (key: string, params?: RemoveParams) => any;
  [EVENT_NAMES.CLOSED]: (key: string) => any;
  [EVENT_NAMES.PRESENT]: (key: string) => any;
  [EVENT_NAMES.PRESENTED]: (key: string) => any;
  [EVENT_NAMES.DISMISS]: (key: string) => any;

  [EVENT_NAMES.SNAP_TO_INDEX]: (key: string, index: number) => any;
};
