import { CreateParams, MODAL_NAMES } from './types';
import { Approval } from '@/components//Approval';
import { SwitchAddress } from '@/components/CommonPopup/SwitchAddress';
import { SwitchChain } from '@/components/CommonPopup/SwitchChain';
import { CancelConnect } from '@/components/CommonPopup/CancelConnect';
import { CancelApproval } from '@/components/CommonPopup/CancelApproval/CancelApproval';
import SimpleConfirmInner from '@/components/CommonPopup/SimpleConfirm';
import { ViewRawDetail } from '@/components/Approval/components/TxComponents/ViewRawModal';
import { SelectChain } from '@/components/SelectChain';
import { CancelTxPopup } from '@/components/CancelTxPopup';
import { SelectSortedChain } from '@/components/SelectSortedChain';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import type { ThemeColors2024 } from '@/constant/theme';
import { ConnectLedger } from '@/components/ConnectLedger/ConnectLedger';
import { SettingLedger } from '@/components/HDSetting/SettingLedger';
import { TipUpgradeModalInner } from '@/components/Upgrade/TipUpgrade';
import { ConnectKeystone } from '@/components/ConnectKeystone/ConnectKeystone';
import { SettingKeystone } from '@/components/HDSetting/SettingKeystone';
import { ConnectOneKey } from '@/components/ConnectOneKey/ConnectOneKey';
import { OneKeyInputPassphrase } from '@/components/OneKeyModal/OneKeyInputPassphrase';
import { OneKeyInputPin } from '@/components/OneKeyModal/OneKeyInputPin';
import { SettingOneKey } from '@/components/HDSetting/SettingOneKey';
import { OneKeyPinOrPassphrase } from '@/components/OneKeyModal/OneKeyPinOrPassphrase';
import {
  TipTermOfUseModalInner,
  TipPrivacyPolicyInner,
} from '@/screens/ManagePassword/components/UserAgreementLikeModalInner';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { SettingHDKeyring } from '@/components/HDSetting/SettingHDKeyring';
import { MarkdownInWebViewInner } from '@/screens/Settings/sheetModals/MarkdownInWebViewTester';
import { NFTDetailPopupInner } from '@/screens/NftDetail/PopupInner';
import { SeedPhraseBackupToCloud } from '@/components/SeedPhraseBackupToCloud2024/SeedPhraseBackupToCloud';
import { SeedPhraseManualBackup } from '@/components2024/SeedPhraseManualBackup';
import { SeedPhraseRestoreFromCloud } from '@/components/SeedPhraseRestoreFromCloud/SeedPhraseRestoreFromCloud';
import { BackupNotAvailableScreen } from '@/components/SeedPhraseBackupToCloud/BackupNotAvailableScreen';
import { WalletConnectConnection } from '@/components/CommonPopup/WalletConnectConnection';
import React from 'react';

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
  [MODAL_NAMES.CONNECT_LEDGER]: ['95%'],
  [MODAL_NAMES.SETTING_LEDGER]: ['85%'],
  [MODAL_NAMES.SETTING_HDKEYRING]: ['85%'],
  [MODAL_NAMES.CONNECT_KEYSTONE]: ['95%'],
  [MODAL_NAMES.SETTING_KEYSTONE]: ['65%'],
  [MODAL_NAMES.CONNECT_ONEKEY]: ['95%'],
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
  [MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD]: [460],
  [MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP]: [800],
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: [],
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: [348],
  [MODAL_NAMES.WALLET_CONNECT]: [300],
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
  [MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP]: SeedPhraseManualBackup,
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: SeedPhraseRestoreFromCloud,
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: BackupNotAvailableScreen,
  [MODAL_NAMES.WALLET_CONNECT]: WalletConnectConnection,
  [MODAL_NAMES.TIP_UPGRADE]: TipUpgradeModalInner,
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: MarkdownInWebViewInner,
  [MODAL_NAMES.TIP_PRIVACY_POLICY]: TipPrivacyPolicyInner,
  [MODAL_NAMES.TIP_TERM_OF_USE]: TipTermOfUseModalInner,
  [MODAL_NAMES.AUTHENTICATION]: AuthenticationModal,
  [MODAL_NAMES.NFT_DETAIL]: NFTDetailPopupInner,
};

export function makeBottomSheetProps(ctx: {
  params: CreateParams;
  colors: (typeof ThemeColors2024)['light'];
  prevProps?: any;
  isDarkTheme: boolean;
}): Partial<React.ComponentProps<typeof AppBottomSheetModal>> {
  return {
    handleStyle: {
      backgroundColor: ctx.isDarkTheme ? '#131416' : '#ffff',
    },
    handleIndicatorStyle: {
      backgroundColor: '#d1d4db',
    },
    backgroundStyle: {
      borderRadius: 16,
    },
  };
}
