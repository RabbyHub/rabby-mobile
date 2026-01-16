import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/src/types';
import type { LinearGradientContainerProps } from '../ScreenContainer/LinearGradientContainer';
import { type ModalComponentProps } from './utils';

export enum MODAL_NAMES {
  // 'COPY_TRADING_TOKEN_DETAIL' = 'COPY_TRADING_TOKEN_DETAIL',
  'NOT_MATTER_ADDRESS_DIALOG' = 'NOT_MATTER_ADDRESS_DIALOG',
  'ADDRESS_LiST' = 'ADDRESS_LiST',
  'APPROVAL' = 'APPROVAL',
  'SWITCH_ADDRESS' = 'SWITCH_ADDRESS',
  'SWITCH_CHAIN' = 'SWITCH_CHAIN',
  'CANCEL_CONNECT' = 'CANCEL_CONNECT',
  'CANCEL_APPROVAL' = 'CANCEL_APPROVAL',
  /** @deprecated */
  'SELECT_CHAIN' = 'SELECT_CHAIN',
  'SIMPLE_CONFIRM' = 'SIMPLE_CONFIRM',
  // 'TMP_CONFIRM_VERIFY' = 'TMP_CONFIRM_VERIFY',
  'SELECT_CHAIN_WITH_SUMMARY' = 'SELECT_CHAIN_WITH_SUMMARY',
  'SELECT_LENDING_CHAIN' = 'SELECT_LENDING_CHAIN',
  'SELECT_CHAIN_WITH_DISTRIBUTE' = 'SELECT_CHAIN_WITH_DISTRIBUTE',
  'VIEW_RAW_DETAILS' = 'VIEW_RAW_DETAILS',
  'CANCEL_TX_POPUP' = 'CANCEL_TX_POPUP',
  'CONNECT_LEDGER' = 'CONNECT_LEDGER',
  'SETTING_LEDGER' = 'SETTING_LEDGER',
  'CONNECT_KEYSTONE' = 'CONNECT_KEYSTONE',
  'SETTING_KEYSTONE' = 'SETTING_KEYSTONE',
  'CONNECT_ONEKEY' = 'CONNECT_ONEKEY',
  'SETTING_ONEKEY' = 'SETTING_ONEKEY',
  'SETTING_HDKEYRING' = 'SETTING_HDKEYRING',
  'SETTING_TREZOR' = 'SETTING_TREZOR',

  'ADD_ADDRESS_SELECT_METHOD' = 'ADD_ADDRESS_SELECT_METHOD',
  'ADD_WHITELIST_SELECT_METHOD' = 'ADD_WHITELIST_SELECT_METHOD',
  'SEED_PHRASE_BACKUP_TO_CLOUD' = 'SEED_PHRASE_BACKUP_TO_CLOUD',
  'SEED_PHRASE_MANUAL_BACKUP' = 'SEED_PHRASE_MANUAL_BACKUP',
  'SEED_PHRASE_RESTORE_FROM_CLOUD' = 'SEED_PHRASE_RESTORE_FROM_CLOUD',
  'SEED_PHRASE_RESTORE_FROM_CLOUD2024' = 'SEED_PHRASE_RESTORE_FROM_CLOUD2024',
  'SEED_PHRASE_BACKUP_NOT_AVAILABLE' = 'SEED_PHRASE_BACKUP_NOT_AVAILABLE',

  'TIP_UPGRADE' = 'TIP_UPGRADE',
  '__TEST_MARKDOWN_IN_WEBVIEW' = '__TEST_MARKDOWN_IN_WEBVIEW',
  'TIP_PRIVACY_POLICY' = 'TIP_PRIVACY_POLICY',
  'TIP_TERM_OF_USE' = 'TIP_TERM_OF_USE',
  'ONEKEY_INPUT_PIN' = 'ONEKEY_INPUT_PIN',
  'ONEKEY_INPUT_PASSPHRASE' = 'ONEKEY_INPUT_PASSPHRASE',
  'ONEKEY_TEMP_PIN_OR_PASSPHRASE' = 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
  'AUTHENTICATION' = 'AUTHENTICATION',
  'CONFIRM_ADDRESS' = 'CONFIRM_ADDRESS',
  'SELECT_CEX' = 'SELECT_CEX',
  'NFT_DETAIL' = 'NFT_DETAIL',
  'DESCRIPTION' = 'DESCRIPTION',
  'ADDRESS_HIGHT_DESC' = 'ADDRESS_HIGHT_DESC',
  'RESTORE_FROM_CLOUD' = 'RESTORE_FROM_CLOUD',
  'ADDRESS_QUICK_MANAGER' = 'ADDRESS_QUICK_MANAGER',
  'ADDRESS_DETAIL' = 'ADDRESS_DETAIL',
  'IMPORT_MORE_ADDRESS' = 'IMPORT_MORE_ADDRESS',
  'NO_LONGER_SUPPORTS' = 'NO_LONGER_SUPPORTS',
  'COLLECTION_NFTS' = 'COLLECTION_NFTS',
  'BATCH_REVOKE_ERROR_REASON' = 'BATCH_REVOKE_ERROR_REASON',
  'SUPPLY_DETAIL' = 'SUPPLY_DETAIL',
  'BORROW_DETAIL' = 'BORROW_DETAIL',
  'SUPPLY_ACTION_DETAIL' = 'SUPPLY_ACTION_DETAIL',
  'BORROW_ACTION_DETAIL' = 'BORROW_ACTION_DETAIL',
  'WITHDRAW_ACTION_DETAIL' = 'WITHDRAW_ACTION_DETAIL',
  'REPAY_ACTION_DETAIL' = 'REPAY_ACTION_DETAIL',
  'HF_DESCRIPTION' = 'HF_DESCRIPTION',
  'MANAGE_EMODE' = 'MANAGE_EMODE',
  'DISABLE_EMODE_OVERVIEW' = 'DISABLE_EMODE_OVERVIEW',
  'MANAGE_EMODE_FULL' = 'MANAGE_EMODE_FULL',
  'SELECT_EMODE_CATEGORY' = 'SELECT_EMODE_CATEGORY',
  'LENDING_SUPPLY_LIST' = 'LENDING_SUPPLY_LIST',
  'LENDING_BORROW_LIST' = 'LENDING_BORROW_LIST',
  'DEBT_TOKEN_SELECT' = 'DEBT_TOKEN_SELECT',
  'DEBT_SWAP' = 'DEBT_SWAP',
  'SEED_PHRASE_QR_CODE' = 'SEED_PHRASE_QR_CODE',
  'LP_TOKEN_DETAIL' = 'LP_TOKEN_DETAIL',
  'COLLATERAL_TOKEN_SELECT' = 'COLLATERAL_TOKEN_SELECT',
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
  'ETHSign' = 'ETHSign',
  'Unknown' = 'Unknown',
  'AddChain' = 'AddChain',
  'AddAsset' = 'AddAsset',
}

export type MODAL_ID = `${MODAL_NAMES}_${string}`;

export type GlobalBottomSheetModalProps = Partial<BottomSheetModalProps> & {
  linearGradientType?: LinearGradientContainerProps['type'];
  /**
   * @description by default we use BottomSheetView, but if your sub views contain scrollable content, you MUST use View as modal's inner root
   * @see https://gorhom.dev/react-native-bottom-sheet/scrollables
   * @default 'BottomSheetView'
   */
  rootViewType?: 'View' | 'BottomSheetView' | 'BottomSheetScrollView';
  rootViewStyle?: RNViewProps['style'];
};

type CreateParamsBase<T extends MODAL_NAMES = MODAL_NAMES> = {
  name: T;
  approvalComponent?: APPROVAL_MODAL_NAMES;
  onCancel?: () => void;
  bottomSheetModalProps?: GlobalBottomSheetModalProps;
  /**
   * @description by default, every global modal instance will prevent the hardware back button on android,
   * @default false
   */
  allowAndroidHarewareBack?: boolean;
  /**
   * @description specify whether preventing screenshot on modal open
   */
  preventScreenshotOnModalOpen?: boolean;
  /**
   * @description specify whether to disable screenshot report before modal close
   */
  screenshotReportFreeBeforeModalClose?: boolean;
};

export type CreateParams<T extends MODAL_NAMES = MODAL_NAMES> =
  CreateParamsBase<T> &
    (T extends MODAL_NAMES
      ? Omit<ModalComponentProps[T], '$createParams'>
      : {});

export type GlobalModalViewProps<
  T extends MODAL_NAMES = MODAL_NAMES,
  P extends object = object,
> = CreateParamsBase<T> & {
  $createParams: CreateParamsBase<T>;
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
  [EVENT_NAMES.CREATE]: (id: MODAL_ID, params: CreateParams) => any;
  [EVENT_NAMES.REMOVE]: (id: MODAL_ID, params?: RemoveParams) => any;
  [EVENT_NAMES.CLOSED]: (id: MODAL_ID) => any;
  [EVENT_NAMES.PRESENT]: (id: MODAL_ID) => any;
  [EVENT_NAMES.PRESENTED]: (id: MODAL_ID) => any;
  [EVENT_NAMES.DISMISS]: (id: MODAL_ID) => any;
  [EVENT_NAMES.SNAP_TO_INDEX]: (id: string, index: number) => any;
};
