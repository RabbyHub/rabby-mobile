import { GlobalBottomSheetModalProps, MODAL_NAMES } from './types';
import { Approval } from '@/components//Approval';
import { SwitchAddress } from '@/components/CommonPopup/SwitchAddress';
import { SwitchChain } from '@/components/CommonPopup/SwitchChain';
import { CancelConnect } from '@/components/CommonPopup/CancelConnect';
import { CancelApproval } from '@/components/CommonPopup/CancelApproval/CancelApproval';
import SimpleConfirmInner from '@/components/CommonPopup/SimpleConfirm';
import { ViewRawDetail } from '@/components/Approval/components/TxComponents/ViewRawModal';
import { SelectChain } from '@/components/SelectChain';
import { CancelTxPopup } from '@/components/CancelTxPopup';
import { SelectChainWithSummary } from '@/components2024/SelectChainWithSummary';
import SelectChainWithDistribute from '@/components2024/SelectChainWithDistribute';
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
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { SettingHDKeyring } from '@/components/HDSetting/SettingHDKeyring';
import { MarkdownInWebViewInner } from '@/screens/Settings/sheetModals/MarkdownInWebViewTester';
import { NFTDetailPopupInner } from '@/screens/NftDetail/PopupInner';
import { SeedPhraseBackupToCloud } from '@/components/SeedPhraseBackupToCloud2024/SeedPhraseBackupToCloud';
import { AddAddressSelectMethod } from '@/components/AddAddressSelectMethod';
import { SeedPhraseManualBackup } from '@/components2024/SeedPhraseManualBackup';
import { BackupNotAvailableScreen } from '@/components/SeedPhraseBackupToCloud/BackupNotAvailableScreen';
import { Descriptions } from '@/components2024/Descriptions';
import React from 'react';
import { RestoreFromCloud2024 } from '@/screens/RestoreFromCloud/RestoreFromCloud2024';
import { SeedPhraseRestoreFromCloud2024 } from '@/components/SeedPhraseRestoreFromCloud/SeedPhraseRestoreFromCloud2024';
import { AddressQuickManager } from '../AddressQuickManager/AddressQuickManager';
import { AddressDetail } from '../AddressDetail/AddressDetail';
import { ImportMoreAddress } from '../ImportMoreAddress/ImportMoreAddress';
import { NoLongerSupports } from '../NoLongerSupports/NoLongerSupports';
import { Dimensions, StyleSheet } from 'react-native';
import { CollectionNFTs } from '../CollectionNFTs';
import { AddWhitelistSelectMethod } from '@/components/AddWhitelistSelectMethod';
import ConfirmAddress from '@/screens/Send/components/ConfirmAddress';
import SelectCex from '@/screens/Send/components/SelectCex';
import { BatchRevokeErrorReason } from '@/screens/BatchRevoke/BatchRevokeErrorReason';
import { SettingTrezor } from '@/components/HDSetting/SettingTrezor';
import { NotMatterAddressDialog } from '@/screens/Address/NotMatterAddressDialog';
import { AddressHightDesc } from '../AddressHightDesc';
import SelectLendingChain from '@/screens/Lending/ChainSelector/SelectLendingChain';
import { SupplyDetailPopup } from '@/screens/Lending/components/SupplyDetailPopup';
import { BorrowDetailPopup } from '@/screens/Lending/components/BorrowDetailPopup';
import { SupplyActionPopup } from '@/screens/Lending/components/actions/SupplyActionPopup';
import { WithdrawActionPopup } from '@/screens/Lending/components/actions/WithdrawActionPopup';
import { BorrowActionPopup } from '@/screens/Lending/components/actions/BorrowActionPopup';
import { RepayActionPopup } from '@/screens/Lending/components/actions/RepayActionPopup';
import { HFDescription } from '@/screens/Lending/components/HFDescription';
import { AddressListModal } from '@/screens/Address/components/MultiAssets/AddressList';
import { ManageEmodeModal } from '@/screens/Lending/modals/ManageEmode';
import ManageEmodeFullModal from '@/screens/Lending/modals/ManangeEmodeFullModal';
import SelectCategoryModal from '@/screens/Lending/components/EmodeCategory/SelectCategoryModal';
import DisableEmodeOverviewModal from '@/screens/Lending/modals/DisableOverViewModal';
import LendingSupplyList from '@/screens/Lending/components/popups/SupplyList';
import LendingBorrowList from '@/screens/Lending/components/popups/BorrowList';
import DebtTokenSelectModal from '@/screens/Lending/components/DebtTokenSelect';
import DebtSwapModal from '@/screens/Lending/modals/DebtSwapModal';
import { SeedPhraseQrCode } from '../AddressDetail/SeedPhraseQrCode';
import { LpTokenDescription } from '../LpTokenDescription';
import CollateralTokenSelectModal from '@/screens/Lending/components/CollateralTokenSelect';

export const MODAL_MAX_HEIGHT = Dimensions.get('window').height - 104;

function getDefaultViewTypePropsPreset(
  input?: Partial<GlobalBottomSheetModalProps>,
): GlobalBottomSheetModalProps {
  return {
    rootViewType: 'View',
    enablePanDownToClose: true,
    enableContentPanningGesture: true,
    ...(input || {}),
    rootViewStyle: StyleSheet.flatten([
      {
        height: '100%',
      },
      input?.rootViewStyle || {},
    ]),
  };
}

export type ModalComponents = {
  [key in MODAL_NAMES]: (typeof MODAL_CONFIGS)[key]['Component'];
};

export type ModalComponentProps = {
  [key in MODAL_NAMES]: React.ComponentProps<ModalComponents[key]>;
};

export const MODAL_CONFIGS = {
  [MODAL_NAMES.APPROVAL]: { snapPoints: ['100%'], Component: Approval },
  [MODAL_NAMES.CANCEL_APPROVAL]: {
    snapPoints: [288],
    Component: CancelApproval,
  },
  [MODAL_NAMES.SWITCH_ADDRESS]: {
    snapPoints: ['45%'],
    Component: SwitchAddress,
  },
  [MODAL_NAMES.SWITCH_CHAIN]: { snapPoints: ['45%'], Component: SwitchChain },
  [MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY]: {
    snapPoints: ['80%'],
    Component: SelectChainWithSummary,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE]: {
    snapPoints: ['80%'],
    Component: SelectChainWithDistribute,
  },
  [MODAL_NAMES.CANCEL_CONNECT]: { snapPoints: [244], Component: CancelConnect },
  [MODAL_NAMES.SELECT_CHAIN]: { snapPoints: ['80%'], Component: SelectChain },
  [MODAL_NAMES.SIMPLE_CONFIRM]: {
    snapPoints: [229],
    Component: SimpleConfirmInner,
  },
  [MODAL_NAMES.VIEW_RAW_DETAILS]: {
    snapPoints: ['80%'],
    Component: ViewRawDetail,
  },
  [MODAL_NAMES.CANCEL_TX_POPUP]: {
    snapPoints: [272],
    Component: CancelTxPopup,
  },
  [MODAL_NAMES.CONNECT_LEDGER]: {
    snapPoints: ['95%'],
    Component: ConnectLedger,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.SETTING_LEDGER]: {
    snapPoints: ['85%'],
    Component: SettingLedger,
  },
  [MODAL_NAMES.SETTING_HDKEYRING]: {
    snapPoints: ['85%'],
    Component: SettingHDKeyring,
  },
  [MODAL_NAMES.COLLECTION_NFTS]: {
    snapPoints: [422],
    Component: CollectionNFTs,
  },
  [MODAL_NAMES.CONNECT_KEYSTONE]: {
    snapPoints: ['95%'],
    Component: ConnectKeystone,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.SETTING_KEYSTONE]: {
    snapPoints: ['65%'],
    Component: SettingKeystone,
  },
  [MODAL_NAMES.CONNECT_ONEKEY]: {
    snapPoints: ['95%'],
    Component: ConnectOneKey,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.SETTING_ONEKEY]: {
    snapPoints: ['55%'],
    Component: SettingOneKey,
  },
  [MODAL_NAMES.SETTING_TREZOR]: {
    snapPoints: ['85%'],
    Component: SettingTrezor,
  },
  [MODAL_NAMES.ONEKEY_INPUT_PIN]: {
    snapPoints: [540],
    Component: OneKeyInputPin,
  },
  [MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE]: {
    snapPoints: [540],
    Component: OneKeyInputPassphrase,
  },
  [MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE]: {
    snapPoints: ['95%'],
    Component: OneKeyPinOrPassphrase,
  },
  [MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD]: {
    snapPoints: [526],
    Component: SeedPhraseBackupToCloud,
  },
  [MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD]: {
    snapPoints: [508],
    Component: AddAddressSelectMethod,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.NOT_MATTER_ADDRESS_DIALOG]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: NotMatterAddressDialog,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.ADDRESS_LiST]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: AddressListModal,
    globalModalPropsPreset: getDefaultViewTypePropsPreset({
      enableContentPanningGesture: true,
      rootViewType: 'View',
    }),
  },
  [MODAL_NAMES.ADD_WHITELIST_SELECT_METHOD]: {
    snapPoints: [492],
    Component: AddWhitelistSelectMethod,
  },
  [MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP]: {
    snapPoints: ['100%'],
    Component: SeedPhraseManualBackup,
  },
  [MODAL_NAMES.SEED_PHRASE_QR_CODE]: {
    snapPoints: [606],
    Component: SeedPhraseQrCode,
  },
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD]: {
    snapPoints: [],
    Component: SeedPhraseRestoreFromCloud2024,
  },
  [MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD2024]: {
    snapPoints: [],
    Component: SeedPhraseRestoreFromCloud2024,
  },
  [MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE]: {
    snapPoints: [348],
    Component: BackupNotAvailableScreen,
  },
  [MODAL_NAMES.TIP_UPGRADE]: {
    snapPoints: ['50%'],
    Component: TipUpgradeModalInner,
  },
  [MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW]: {
    snapPoints: ['80%'],
    Component: MarkdownInWebViewInner,
  },
  [MODAL_NAMES.TIP_PRIVACY_POLICY]: {
    snapPoints: ['80%'],
    Component: TipPrivacyPolicyInner,
  },
  [MODAL_NAMES.TIP_TERM_OF_USE]: {
    snapPoints: ['80%'],
    Component: TipTermOfUseModalInner,
  },
  [MODAL_NAMES.AUTHENTICATION]: {
    snapPoints: undefined,
    Component: AuthenticationModal2024,
  },
  [MODAL_NAMES.CONFIRM_ADDRESS]: {
    snapPoints: undefined,
    Component: ConfirmAddress,
  },
  [MODAL_NAMES.SELECT_CEX]: { snapPoints: ['80%'], Component: SelectCex },
  [MODAL_NAMES.NFT_DETAIL]: {
    snapPoints: ['85%'],
    Component: NFTDetailPopupInner,
  },
  [MODAL_NAMES.DESCRIPTION]: {
    snapPoints: [674],
    Component: Descriptions,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.MANAGE_EMODE]: {
    snapPoints: [248],
    Component: ManageEmodeModal,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.DISABLE_EMODE_OVERVIEW]: {
    snapPoints: [580],
    Component: DisableEmodeOverviewModal,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.ADDRESS_HIGHT_DESC]: {
    snapPoints: [273],
    Component: AddressHightDesc,
  },
  [MODAL_NAMES.RESTORE_FROM_CLOUD]: {
    snapPoints: ['85%'],
    Component: RestoreFromCloud2024,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.ADDRESS_QUICK_MANAGER]: {
    snapPoints: undefined,
    Component: AddressQuickManager,
  },
  [MODAL_NAMES.ADDRESS_DETAIL]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: AddressDetail,
  },
  [MODAL_NAMES.IMPORT_MORE_ADDRESS]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: ImportMoreAddress,
  },
  [MODAL_NAMES.NO_LONGER_SUPPORTS]: {
    snapPoints: ['85%'],
    Component: NoLongerSupports,
  },
  [MODAL_NAMES.BATCH_REVOKE_ERROR_REASON]: {
    snapPoints: undefined,
    Component: BatchRevokeErrorReason,
  },
  [MODAL_NAMES.SUPPLY_DETAIL]: {
    snapPoints: [606],
    Component: SupplyDetailPopup,
  },
  [MODAL_NAMES.BORROW_DETAIL]: {
    snapPoints: ['85%'],
    Component: BorrowDetailPopup,
  },
  [MODAL_NAMES.SUPPLY_ACTION_DETAIL]: {
    snapPoints: [686],
    Component: SupplyActionPopup,
  },
  [MODAL_NAMES.WITHDRAW_ACTION_DETAIL]: {
    snapPoints: [734],
    Component: WithdrawActionPopup,
  },
  [MODAL_NAMES.BORROW_ACTION_DETAIL]: {
    snapPoints: [686],
    Component: BorrowActionPopup,
  },
  [MODAL_NAMES.REPAY_ACTION_DETAIL]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: RepayActionPopup,
  },
  [MODAL_NAMES.HF_DESCRIPTION]: {
    snapPoints: [674],
    Component: HFDescription,
  },
  [MODAL_NAMES.SELECT_LENDING_CHAIN]: {
    snapPoints: ['80%'],
    Component: SelectLendingChain,
  },
  [MODAL_NAMES.MANAGE_EMODE_FULL]: {
    snapPoints: ['100%'],
    Component: ManageEmodeFullModal,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.SELECT_EMODE_CATEGORY]: {
    snapPoints: ['85%'],
    Component: SelectCategoryModal,
  },
  [MODAL_NAMES.LENDING_SUPPLY_LIST]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: LendingSupplyList,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.LENDING_BORROW_LIST]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: LendingBorrowList,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.DEBT_TOKEN_SELECT]: {
    snapPoints: ['85%'],
    Component: DebtTokenSelectModal,
  },
  [MODAL_NAMES.DEBT_SWAP]: {
    snapPoints: [MODAL_MAX_HEIGHT],
    Component: DebtSwapModal,
  },
  [MODAL_NAMES.LP_TOKEN_DETAIL]: {
    snapPoints: [241],
    Component: LpTokenDescription,
    globalModalPropsPreset: getDefaultViewTypePropsPreset(),
  },
  [MODAL_NAMES.COLLATERAL_TOKEN_SELECT]: {
    snapPoints: ['85%'],
    Component: CollateralTokenSelectModal,
  },
};
