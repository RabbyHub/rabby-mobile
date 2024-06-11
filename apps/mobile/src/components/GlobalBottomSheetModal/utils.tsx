import { APPROVAL_MODAL_NAMES, CreateParams, MODAL_NAMES } from './types';
import { Approval } from '../Approval';
import { SwitchAddress } from '../CommonPopup/SwitchAddress';
import { SwitchChain } from '../CommonPopup/SwitchChain';
import { CancelConnect } from '../CommonPopup/CancelConnect';
import { CancelApproval } from '../CommonPopup/CancelApproval/CancelApproval';
import SimpleConfirmInner from '../CommonPopup/SimpleConfirm';
import { ViewRawDetail } from '../Approval/components/TxComponents/ViewRawModal';
import { SelectChain } from '../SelectChain';
import { CancelTxPopup } from '../CancelTxPopup';
import { SelectSortedChain } from '../SelectSortedChain';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import type { ThemeColors } from '@/constant/theme';
import { ConnectLedger } from '../ConnectLedger/ConnectLedger';
import { SettingLedger } from '../HDSetting/SettingLedger';
import { TipUpgradeModalInner } from '../Upgrade/TipUpgrade';
import { ConnectKeystone } from '../ConnectKeystone/ConnectKeystone';
import { SettingKeystone } from '../HDSetting/SettingKeystone';
import { ConnectOneKey } from '../ConnectOneKey/ConnectOneKey';
import { OneKeyInputPassphrase } from '../OneKeyModal/OneKeyInputPassphrase';
import { OneKeyInputPin } from '../OneKeyModal/OneKeyInputPin';
import { SettingOneKey } from '../HDSetting/SettingOneKey';
import { OneKeyPinOrPassphrase } from '../OneKeyModal/OneKeyPinOrPassphrase';
import { TipTermOfUseModalInner } from '@/screens/ManagePassword/components/TipTermOfUseModalInner';

export const SNAP_POINTS: Record<MODAL_NAMES, (string | number)[]> = {
  [MODAL_NAMES.APPROVAL]: ['100%'],
  [MODAL_NAMES.CANCEL_APPROVAL]: [288],
  [MODAL_NAMES.SWITCH_ADDRESS]: ['45%'],
  [MODAL_NAMES.SWITCH_CHAIN]: ['45%'],
  [MODAL_NAMES.SELECT_SORTED_CHAIN]: ['80%'],
  [MODAL_NAMES.CANCEL_CONNECT]: [244],
  [MODAL_NAMES.SELECT_CHAIN]: ['80%'],
  [MODAL_NAMES.SIMPLE_CONFIRM]: [229],
  [MODAL_NAMES.VIEW_RAW_DETAILS]: ['80%'],
  [MODAL_NAMES.CANCEL_TX_POPUP]: [272],
  [MODAL_NAMES.CONNECT_LEDGER]: ['68%'],
  [MODAL_NAMES.SETTING_LEDGER]: ['85%'],
  [MODAL_NAMES.CONNECT_KEYSTONE]: ['68%'],
  [MODAL_NAMES.SETTING_KEYSTONE]: ['65%'],
  [MODAL_NAMES.CONNECT_ONEKEY]: ['68%'],
  [MODAL_NAMES.SETTING_ONEKEY]: ['55%'],
  [MODAL_NAMES.TIP_UPGRADE]: ['50%'],
  [MODAL_NAMES.TIP_TERM_OF_USE]: ['80%'],
  [MODAL_NAMES.ONEKEY_INPUT_PIN]: [540],
  [MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE]: [540],
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: ['68%'],
};

export const APPROVAL_SNAP_POINTS: Record<
  APPROVAL_MODAL_NAMES,
  (string | number)[]
> = {
  [APPROVAL_MODAL_NAMES.Connect]: ['90%'],
  [APPROVAL_MODAL_NAMES.SignText]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTypedData]: ['100%'],
  [APPROVAL_MODAL_NAMES.SignTx]: ['100%'],
  [APPROVAL_MODAL_NAMES.WatchAddressWaiting]: [360, 400],
  [APPROVAL_MODAL_NAMES.LedgerHardwareWaiting]: [400, 455],
  [APPROVAL_MODAL_NAMES.KeystoneHardwareWaiting]: [440, 455],
  [APPROVAL_MODAL_NAMES.OneKeyHardwareWaiting]: [400, 455],
};

export const MODAL_VIEWS: Record<MODAL_NAMES, React.FC<any>> = {
  [MODAL_NAMES.APPROVAL]: Approval,
  [MODAL_NAMES.CANCEL_APPROVAL]: CancelApproval,
  [MODAL_NAMES.SWITCH_ADDRESS]: SwitchAddress,
  [MODAL_NAMES.SWITCH_CHAIN]: SwitchChain,
  [MODAL_NAMES.CANCEL_CONNECT]: CancelConnect,
  [MODAL_NAMES.SELECT_CHAIN]: SelectChain,
  [MODAL_NAMES.SIMPLE_CONFIRM]: SimpleConfirmInner,
  [MODAL_NAMES.SELECT_SORTED_CHAIN]: SelectSortedChain,
  [MODAL_NAMES.VIEW_RAW_DETAILS]: ViewRawDetail,
  [MODAL_NAMES.CANCEL_TX_POPUP]: CancelTxPopup,
  [MODAL_NAMES.CONNECT_LEDGER]: ConnectLedger,
  [MODAL_NAMES.SETTING_LEDGER]: SettingLedger,
  [MODAL_NAMES.CONNECT_KEYSTONE]: ConnectKeystone,
  [MODAL_NAMES.SETTING_KEYSTONE]: SettingKeystone,
  [MODAL_NAMES.CONNECT_ONEKEY]: ConnectOneKey,
  [MODAL_NAMES.SETTING_ONEKEY]: SettingOneKey,
  [MODAL_NAMES.ONEKEY_INPUT_PIN]: OneKeyInputPin,
  [MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE]: OneKeyInputPassphrase,
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: OneKeyPinOrPassphrase,

  [MODAL_NAMES.TIP_UPGRADE]: TipUpgradeModalInner,
  [MODAL_NAMES.TIP_TERM_OF_USE]: TipTermOfUseModalInner,
};

export function makeBottomSheetProps(ctx: {
  params: CreateParams;
  colors: (typeof ThemeColors)['light'];
  prevProps?: any;
}): Partial<React.ComponentProps<typeof AppBottomSheetModal>> {
  if (ctx.params.approvalComponent === 'Connect') {
    return {
      handleStyle: {
        backgroundColor: ctx.colors['neutral-bg-1'],
      },
      handleIndicatorStyle: {
        backgroundColor: ctx.colors['neutral-line'],
      },
    };
  }

  if (ctx.params?.name === 'APPROVAL') {
    if (
      [
        APPROVAL_MODAL_NAMES.KeystoneHardwareWaiting,
        APPROVAL_MODAL_NAMES.LedgerHardwareWaiting,
        APPROVAL_MODAL_NAMES.OneKeyHardwareWaiting,
        APPROVAL_MODAL_NAMES.WatchAddressWaiting,
      ].includes(ctx.params.approvalComponent as APPROVAL_MODAL_NAMES)
    ) {
      return {
        handleStyle: {
          backgroundColor: 'transparent',
        },
      };
    }
    return {
      handleStyle: {
        backgroundColor: ctx.colors['neutral-bg-2'],
      },
      handleIndicatorStyle: {
        backgroundColor: ctx.colors['neutral-line'],
      },
    };
  }

  return {
    backgroundStyle: {
      backgroundColor: ctx.colors['neutral-bg-1'],
    },
  };
}
