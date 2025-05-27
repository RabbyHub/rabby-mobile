import { MODAL_NAMES } from './types';
import React from 'react';
import { Dimensions } from 'react-native';

const Approval = React.lazy(() =>
  import('@/components/Approval').then(m => ({ default: m.Approval })),
);
const CancelApproval = React.lazy(() =>
  import('@/components/CommonPopup/CancelApproval/CancelApproval').then(m => ({
    default: m.CancelApproval,
  })),
);
const SwitchAddress = React.lazy(() =>
  import('@/components/CommonPopup/SwitchAddress').then(m => ({
    default: m.SwitchAddress,
  })),
);
const SwitchChain = React.lazy(() =>
  import('@/components/CommonPopup/SwitchChain').then(m => ({
    default: m.SwitchChain,
  })),
);
const CancelConnect = React.lazy(() =>
  import('@/components/CommonPopup/CancelConnect').then(m => ({
    default: m.CancelConnect,
  })),
);
const SelectChain = React.lazy(() =>
  import('@/components/SelectChain').then(m => ({ default: m.SelectChain })),
);
const SimpleConfirmInner = React.lazy(() =>
  import('@/components/CommonPopup/SimpleConfirm').then(m => ({
    default: m.default,
  })),
);
const SelectSortedChain = React.lazy(() =>
  import('@/components2024/SelectSortedChain').then(m => ({
    default: m.SelectSortedChain,
  })),
);
const SelectChainWithSummary = React.lazy(() =>
  import('@/components2024/SelectChainWithSummary').then(m => ({
    default: m.SelectChainWithSummary,
  })),
);
const SelectChainWithDistribute = React.lazy(() =>
  import('@/components2024/SelectChainWithDistribute').then(m => ({
    default: m.default,
  })),
);
const CollectionNFTs = React.lazy(() =>
  import('@/components2024/CollectionNFTs').then(m => ({
    default: m.CollectionNFTs,
  })),
);
const ViewRawDetail = React.lazy(() =>
  import('@/components/Approval/components/TxComponents/ViewRawModal').then(
    m => ({ default: m.ViewRawDetail }),
  ),
);
const CancelTxPopup = React.lazy(() =>
  import('@/components/CancelTxPopup').then(m => ({
    default: m.CancelTxPopup,
  })),
);
const ConnectLedger = React.lazy(() =>
  import('@/components/ConnectLedger/ConnectLedger').then(m => ({
    default: m.ConnectLedger,
  })),
);
const SettingLedger = React.lazy(() =>
  import('@/components/HDSetting/SettingLedger').then(m => ({
    default: m.SettingLedger,
  })),
);
const ConnectKeystone = React.lazy(() =>
  import('@/components/ConnectKeystone/ConnectKeystone').then(m => ({
    default: m.ConnectKeystone,
  })),
);
const SettingKeystone = React.lazy(() =>
  import('@/components/HDSetting/SettingKeystone').then(m => ({
    default: m.SettingKeystone,
  })),
);
const ConnectOneKey = React.lazy(() =>
  import('@/components/ConnectOneKey/ConnectOneKey').then(m => ({
    default: m.ConnectOneKey,
  })),
);
const SettingOneKey = React.lazy(() =>
  import('@/components/HDSetting/SettingOneKey').then(m => ({
    default: m.SettingOneKey,
  })),
);
const SettingHDKeyring = React.lazy(() =>
  import('@/components/HDSetting/SettingHDKeyring').then(m => ({
    default: m.SettingHDKeyring,
  })),
);
const OneKeyInputPin = React.lazy(() =>
  import('@/components/OneKeyModal/OneKeyInputPin').then(m => ({
    default: m.OneKeyInputPin,
  })),
);
const OneKeyInputPassphrase = React.lazy(() =>
  import('@/components/OneKeyModal/OneKeyInputPassphrase').then(m => ({
    default: m.OneKeyInputPassphrase,
  })),
);
const OneKeyPinOrPassphrase = React.lazy(() =>
  import('@/components/OneKeyModal/OneKeyPinOrPassphrase').then(m => ({
    default: m.OneKeyPinOrPassphrase,
  })),
);
const SeedPhraseBackupToCloud = React.lazy(() =>
  import(
    '@/components/SeedPhraseBackupToCloud2024/SeedPhraseBackupToCloud'
  ).then(m => ({ default: m.SeedPhraseBackupToCloud })),
);
const AddAddressSelectMethod = React.lazy(() =>
  import('@/components/AddAddressSelectMethod').then(m => ({
    default: m.AddAddressSelectMethod,
  })),
);
const FundYourWallet = React.lazy(() =>
  import('@/screens/Home/FundYourWallet').then(m => ({
    default: m.FundYourWallet,
  })),
);
const AddWhitelistSelectMethod = React.lazy(() =>
  import('@/components/AddWhitelistSelectMethod').then(m => ({
    default: m.AddWhitelistSelectMethod,
  })),
);
const SeedPhraseManualBackup = React.lazy(() =>
  import('@/components2024/SeedPhraseManualBackup').then(m => ({
    default: m.SeedPhraseManualBackup,
  })),
);
const SeedPhraseRestoreFromCloud = React.lazy(() =>
  import(
    '@/components/SeedPhraseRestoreFromCloud/SeedPhraseRestoreFromCloud'
  ).then(m => ({ default: m.SeedPhraseRestoreFromCloud })),
);
const SeedPhraseRestoreFromCloud2024 = React.lazy(() =>
  import(
    '@/components/SeedPhraseRestoreFromCloud/SeedPhraseRestoreFromCloud2024'
  ).then(m => ({ default: m.SeedPhraseRestoreFromCloud2024 })),
);
const BackupNotAvailableScreen = React.lazy(() =>
  import('@/components/SeedPhraseBackupToCloud/BackupNotAvailableScreen').then(
    m => ({ default: m.BackupNotAvailableScreen }),
  ),
);
const TipUpgradeModalInner = React.lazy(() =>
  import('@/components/Upgrade/TipUpgrade').then(m => ({
    default: m.TipUpgradeModalInner,
  })),
);
const MarkdownInWebViewInner = React.lazy(() =>
  import('@/screens/Settings/sheetModals/MarkdownInWebViewTester').then(m => ({
    default: m.MarkdownInWebViewInner,
  })),
);
const TipPrivacyPolicyInner = React.lazy(() =>
  import(
    '@/screens/ManagePassword/components/UserAgreementLikeModalInner'
  ).then(m => ({ default: m.TipPrivacyPolicyInner })),
);
const TipTermOfUseModalInner = React.lazy(() =>
  import(
    '@/screens/ManagePassword/components/UserAgreementLikeModalInner'
  ).then(m => ({ default: m.TipTermOfUseModalInner })),
);
const AuthenticationModal2024 = React.lazy(() =>
  import('@/components/AuthenticationModal/AuthenticationModal2024').then(
    m => ({ default: m.AuthenticationModal2024 }),
  ),
);
const ConfirmAddress = React.lazy(() =>
  import('@/screens/Send/components/ConfirmAddress').then(m => ({
    default: m.default,
  })),
);
const SelectCex = React.lazy(() =>
  import('@/screens/Send/components/SelectCex').then(m => ({
    default: m.default,
  })),
);
const NFTDetailPopupInner = React.lazy(() =>
  import('@/screens/NftDetail/PopupInner').then(m => ({
    default: m.NFTDetailPopupInner,
  })),
);
const Descriptions = React.lazy(() =>
  import('@/components2024/Descriptions').then(m => ({
    default: m.Descriptions,
  })),
);
const RestoreFromCloud2024 = React.lazy(() =>
  import('@/screens/RestoreFromCloud/RestoreFromCloud2024').then(m => ({
    default: m.RestoreFromCloud2024,
  })),
);
const AddressQuickManager = React.lazy(() =>
  import('../AddressQuickManager/AddressQuickManager').then(m => ({
    default: m.AddressQuickManager,
  })),
);
const AddressDetail = React.lazy(() =>
  import('../AddressDetail/AddressDetail').then(m => ({
    default: m.AddressDetail,
  })),
);
const ImportMoreAddress = React.lazy(() =>
  import('../ImportMoreAddress/ImportMoreAddress').then(m => ({
    default: m.ImportMoreAddress,
  })),
);
const NoLongerSupports = React.lazy(() =>
  import('../NoLongerSupports/NoLongerSupports').then(m => ({
    default: m.NoLongerSupports,
  })),
);
const BatchRevokeErrorReason = React.lazy(() =>
  import('@/screens/BatchRevoke/BatchRevokeErrorReason').then(m => ({
    default: m.BatchRevokeErrorReason,
  })),
);

export const MODAL_MAX_HEIGHT = Dimensions.get('window').height - 104;

type SnapPoints = Record<MODAL_NAMES, (string | number)[] | undefined>;
export const SNAP_POINTS: SnapPoints = {
  [MODAL_NAMES.APPROVAL]: ['100%'],
  [MODAL_NAMES.CANCEL_APPROVAL]: [288],
  [MODAL_NAMES.SWITCH_ADDRESS]: ['45%'],
  [MODAL_NAMES.SWITCH_CHAIN]: ['45%'],
  [MODAL_NAMES.SELECT_SORTED_CHAIN]: ['80%'],
  [MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY]: ['80%'],
  [MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE]: ['80%'],
  [MODAL_NAMES.CANCEL_CONNECT]: [244],
  [MODAL_NAMES.SELECT_CHAIN]: ['80%'],
  [MODAL_NAMES.SIMPLE_CONFIRM]: [229],
  [MODAL_NAMES.VIEW_RAW_DETAILS]: ['80%'],
  [MODAL_NAMES.CANCEL_TX_POPUP]: [272],
  [MODAL_NAMES.CONNECT_LEDGER]: ['95%'],
  [MODAL_NAMES.SETTING_LEDGER]: ['85%'],
  [MODAL_NAMES.SETTING_HDKEYRING]: ['85%'],
  [MODAL_NAMES.COLLECTION_NFTS]: [422],
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
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: ['95%'],
  [MODAL_NAMES.AUTHENTICATION]: undefined,
  [MODAL_NAMES.CONFIRM_ADDRESS]: undefined,
  [MODAL_NAMES.SELECT_CEX]: ['80%'],
  [MODAL_NAMES.NFT_DETAIL]: ['85%'],
  [MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD]: [526],
  [MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP]: ['95%'],
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: [],
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD2024]: [],
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: [348],
  [MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD]: [494],
  [MODAL_NAMES.FOUND_YOUR_WALLET_GUIDE]: [470],
  [MODAL_NAMES.ADD_WHITELIST_SELECT_METHOD]: [492],
  [MODAL_NAMES.DESCRIPTION]: [674],
  [MODAL_NAMES.RESTORE_FROM_CLOUD]: ['85%'],
  [MODAL_NAMES.ADDRESS_QUICK_MANAGER]: undefined,
  [MODAL_NAMES.ADDRESS_DETAIL]: [MODAL_MAX_HEIGHT],
  [MODAL_NAMES.IMPORT_MORE_ADDRESS]: [MODAL_MAX_HEIGHT],
  [MODAL_NAMES.NO_LONGER_SUPPORTS]: ['85%'],
  [MODAL_NAMES.BATCH_REVOKE_ERROR_REASON]: undefined,
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
  [MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY]: SelectChainWithSummary,
  [MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE]: SelectChainWithDistribute,
  [MODAL_NAMES.COLLECTION_NFTS]: CollectionNFTs,
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
  [MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD]: AddAddressSelectMethod,
  [MODAL_NAMES.FOUND_YOUR_WALLET_GUIDE]: FundYourWallet,
  [MODAL_NAMES.ADD_WHITELIST_SELECT_METHOD]: AddWhitelistSelectMethod,
  [MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP]: SeedPhraseManualBackup,
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: SeedPhraseRestoreFromCloud,
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD2024]:
    SeedPhraseRestoreFromCloud2024,
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: BackupNotAvailableScreen,
  [MODAL_NAMES.TIP_UPGRADE]: TipUpgradeModalInner,
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: MarkdownInWebViewInner,
  [MODAL_NAMES.TIP_PRIVACY_POLICY]: TipPrivacyPolicyInner,
  [MODAL_NAMES.TIP_TERM_OF_USE]: TipTermOfUseModalInner,
  [MODAL_NAMES.AUTHENTICATION]: AuthenticationModal2024,
  [MODAL_NAMES.CONFIRM_ADDRESS]: ConfirmAddress,
  [MODAL_NAMES.SELECT_CEX]: SelectCex,
  [MODAL_NAMES.NFT_DETAIL]: NFTDetailPopupInner,
  [MODAL_NAMES.DESCRIPTION]: Descriptions,
  [MODAL_NAMES.RESTORE_FROM_CLOUD]: RestoreFromCloud2024,
  [MODAL_NAMES.ADDRESS_QUICK_MANAGER]: AddressQuickManager,
  [MODAL_NAMES.ADDRESS_DETAIL]: AddressDetail,
  [MODAL_NAMES.IMPORT_MORE_ADDRESS]: ImportMoreAddress,
  [MODAL_NAMES.NO_LONGER_SUPPORTS]: NoLongerSupports,
  [MODAL_NAMES.BATCH_REVOKE_ERROR_REASON]: BatchRevokeErrorReason,
};
