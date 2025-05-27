import React from 'react';
import { APPROVAL_MODAL_NAMES, CreateParams, MODAL_NAMES } from './types';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import type { ThemeColors } from '@/constant/theme';

const Approval = React.lazy(() =>
  import('../Approval').then(m => ({ default: m.Approval })),
);
const CancelApproval = React.lazy(() =>
  import('../CommonPopup/CancelApproval/CancelApproval').then(m => ({
    default: m.CancelApproval,
  })),
);
const SwitchAddress = React.lazy(() =>
  import('../CommonPopup/SwitchAddress').then(m => ({
    default: m.SwitchAddress,
  })),
);
const SwitchChain = React.lazy(() =>
  import('../CommonPopup/SwitchChain').then(m => ({ default: m.SwitchChain })),
);
const CancelConnect = React.lazy(() =>
  import('../CommonPopup/CancelConnect').then(m => ({
    default: m.CancelConnect,
  })),
);
const SelectChain = React.lazy(() =>
  import('../SelectChain').then(m => ({ default: m.SelectChain })),
);
const SimpleConfirmInner = React.lazy(() =>
  import('../CommonPopup/SimpleConfirm').then(m => ({ default: m.default })),
);
const SelectSortedChain = React.lazy(() =>
  import('../SelectSortedChain').then(m => ({ default: m.SelectSortedChain })),
);
const ViewRawDetail = React.lazy(() =>
  import('../Approval/components/TxComponents/ViewRawModal').then(m => ({
    default: m.ViewRawDetail,
  })),
);
const CancelTxPopup = React.lazy(() =>
  import('../CancelTxPopup').then(m => ({ default: m.CancelTxPopup })),
);
const ConnectLedger = React.lazy(() =>
  import('../ConnectLedger/ConnectLedger').then(m => ({
    default: m.ConnectLedger,
  })),
);
const SettingLedger = React.lazy(() =>
  import('../HDSetting/SettingLedger').then(m => ({
    default: m.SettingLedger,
  })),
);
const TipUpgradeModalInner = React.lazy(() =>
  import('../Upgrade/TipUpgrade').then(m => ({
    default: m.TipUpgradeModalInner,
  })),
);
const ConnectKeystone = React.lazy(() =>
  import('../ConnectKeystone/ConnectKeystone').then(m => ({
    default: m.ConnectKeystone,
  })),
);
const SettingKeystone = React.lazy(() =>
  import('../HDSetting/SettingKeystone').then(m => ({
    default: m.SettingKeystone,
  })),
);
const ConnectOneKey = React.lazy(() =>
  import('../ConnectOneKey/ConnectOneKey').then(m => ({
    default: m.ConnectOneKey,
  })),
);
const OneKeyInputPassphrase = React.lazy(() =>
  import('../OneKeyModal/OneKeyInputPassphrase').then(m => ({
    default: m.OneKeyInputPassphrase,
  })),
);
const OneKeyInputPin = React.lazy(() =>
  import('../OneKeyModal/OneKeyInputPin').then(m => ({
    default: m.OneKeyInputPin,
  })),
);
const SettingOneKey = React.lazy(() =>
  import('../HDSetting/SettingOneKey').then(m => ({
    default: m.SettingOneKey,
  })),
);
const OneKeyPinOrPassphrase = React.lazy(() =>
  import('../OneKeyModal/OneKeyPinOrPassphrase').then(m => ({
    default: m.OneKeyPinOrPassphrase,
  })),
);
const TipTermOfUseModalInner = React.lazy(() =>
  import(
    '@/screens/ManagePassword/components/UserAgreementLikeModalInner'
  ).then(m => ({ default: m.TipTermOfUseModalInner })),
);
const TipPrivacyPolicyInner = React.lazy(() =>
  import(
    '@/screens/ManagePassword/components/UserAgreementLikeModalInner'
  ).then(m => ({ default: m.TipPrivacyPolicyInner })),
);
const AuthenticationModal = React.lazy(() =>
  import('../AuthenticationModal/AuthenticationModal').then(m => ({
    default: m.AuthenticationModal,
  })),
);
const SettingHDKeyring = React.lazy(() =>
  import('../HDSetting/SettingHDKeyring').then(m => ({
    default: m.SettingHDKeyring,
  })),
);
const MarkdownInWebViewInner = React.lazy(() =>
  import('@/screens/Settings/sheetModals/MarkdownInWebViewTester').then(m => ({
    default: m.MarkdownInWebViewInner,
  })),
);
const NFTDetailPopupInner = React.lazy(() =>
  import('@/screens/NftDetail/PopupInner').then(m => ({
    default: m.NFTDetailPopupInner,
  })),
);
const SeedPhraseBackupToCloud = React.lazy(() =>
  import('../SeedPhraseBackupToCloud/SeedPhraseBackupToCloud').then(m => ({
    default: m.SeedPhraseBackupToCloud,
  })),
);
const SeedPhraseRestoreFromCloud = React.lazy(() =>
  import('../SeedPhraseRestoreFromCloud/SeedPhraseRestoreFromCloud').then(
    m => ({ default: m.SeedPhraseRestoreFromCloud }),
  ),
);
const BackupNotAvailableScreen = React.lazy(() =>
  import('../SeedPhraseBackupToCloud/BackupNotAvailableScreen').then(m => ({
    default: m.BackupNotAvailableScreen,
  })),
);

type SnapPoints = Record<MODAL_NAMES, (string | number)[] | undefined>;
export const SNAP_POINTS: SnapPoints = {
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
  [MODAL_NAMES.SETTING_HDKEYRING]: ['85%'],
  [MODAL_NAMES.CONNECT_KEYSTONE]: ['68%'],
  [MODAL_NAMES.SETTING_KEYSTONE]: ['65%'],
  [MODAL_NAMES.CONNECT_ONEKEY]: ['68%'],
  [MODAL_NAMES.SETTING_ONEKEY]: ['55%'],
  [MODAL_NAMES.TIP_UPGRADE]: ['50%'],
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: ['80%'],
  [MODAL_NAMES.TIP_PRIVACY_POLICY]: ['80%'],
  [MODAL_NAMES.TIP_TERM_OF_USE]: ['80%'],
  [MODAL_NAMES.ONEKEY_INPUT_PIN]: [540],
  [MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE]: [540],
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: ['68%'],
  [MODAL_NAMES.AUTHENTICATION]: undefined,
  [MODAL_NAMES.NFT_DETAIL]: ['85%'],
  [MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD]: [],
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: [],
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: [348],
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
  [MODAL_NAMES.SETTING_HDKEYRING]: SettingHDKeyring,
  [MODAL_NAMES.ONEKEY_INPUT_PIN]: OneKeyInputPin,
  [MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE]: OneKeyInputPassphrase,
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: OneKeyPinOrPassphrase,
  [MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD]: SeedPhraseBackupToCloud,
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: SeedPhraseRestoreFromCloud,
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: BackupNotAvailableScreen,
  [MODAL_NAMES.TIP_UPGRADE]: TipUpgradeModalInner,
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: MarkdownInWebViewInner,
  [MODAL_NAMES.TIP_PRIVACY_POLICY]: TipPrivacyPolicyInner,
  [MODAL_NAMES.TIP_TERM_OF_USE]: TipTermOfUseModalInner,
  [MODAL_NAMES.AUTHENTICATION]: AuthenticationModal,
  [MODAL_NAMES.NFT_DETAIL]: NFTDetailPopupInner,
};

export function makeClassicalBottomSheetProps(ctx: {
  params: CreateParams;
  colors: (typeof ThemeColors)['light'];
  prevProps?: any;
}): Pick<
  Partial<React.ComponentProps<typeof AppBottomSheetModal>>,
  'handleStyle' | 'handleIndicatorStyle' | 'backgroundStyle'
> {
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

  if (ctx.params?.name === MODAL_NAMES.VIEW_RAW_DETAILS) {
    return {
      handleStyle: {
        backgroundColor: ctx.colors['neutral-bg-2'],
      },
      handleIndicatorStyle: {
        backgroundColor: ctx.colors['neutral-line'],
      },
    };
  }

  if (ctx.params?.name === MODAL_NAMES.APPROVAL) {
    if (
      [
        APPROVAL_MODAL_NAMES.KeystoneHardwareWaiting,
        APPROVAL_MODAL_NAMES.LedgerHardwareWaiting,
        APPROVAL_MODAL_NAMES.PrivatekeyWaiting,
        APPROVAL_MODAL_NAMES.OneKeyHardwareWaiting,
        APPROVAL_MODAL_NAMES.WatchAddressWaiting,
        APPROVAL_MODAL_NAMES.ETHSign,
        APPROVAL_MODAL_NAMES.AddAsset,
        APPROVAL_MODAL_NAMES.AddChain,
        APPROVAL_MODAL_NAMES.Unknown,
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
        backgroundColor: ctx.colors['neutral-bg-4'],
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
