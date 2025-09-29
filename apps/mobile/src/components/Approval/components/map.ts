import { APPROVAL_MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ApprovalComponentType } from '.';

export const WaitingSignComponent: Record<string, ApprovalComponentType> = {
  [KEYRING_CLASS.MNEMONIC]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.PRIVATE_KEY]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.HARDWARE.LEDGER]: 'LedgerHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.ONEKEY]: 'OneKeyHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: 'KeystoneHardwareWaiting',
  [KEYRING_CLASS.HARDWARE.TREZOR]: 'TrezorHardwareWaiting',
  [KEYRING_CLASS.PRIVATE_KEY]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.MNEMONIC]: 'PrivatekeyWaiting',
};

export const APPROVAL_SNAP_POINTS: Record<
  APPROVAL_MODAL_NAMES,
  (string | number)[]
> = {
  [APPROVAL_MODAL_NAMES.Connect]: ['80%'],
  [APPROVAL_MODAL_NAMES.SignText]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTypedData]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTx]: ['100%'],
  [APPROVAL_MODAL_NAMES.WatchAddressWaiting]: [360, 400],
  [APPROVAL_MODAL_NAMES.LedgerHardwareWaiting]: [400, 285],
  [APPROVAL_MODAL_NAMES.KeystoneHardwareWaiting]: [440, 455],
  [APPROVAL_MODAL_NAMES.OneKeyHardwareWaiting]: [400, 285],
  [APPROVAL_MODAL_NAMES.PrivatekeyWaiting]: [200, 285],
  [APPROVAL_MODAL_NAMES.TrezorHardwareWaiting]: [200, 255],
  [APPROVAL_MODAL_NAMES.ETHSign]: [300],
  [APPROVAL_MODAL_NAMES.Unknown]: [300],
  [APPROVAL_MODAL_NAMES.AddChain]: ['90%'],
  [APPROVAL_MODAL_NAMES.AddAsset]: ['90%'],
};
