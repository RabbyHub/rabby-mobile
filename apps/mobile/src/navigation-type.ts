import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';

import { KeyringAccountWithAlias } from '@/hooks/account';
import {} from '@react-navigation/bottom-tabs';

import type { RootNames } from './constant/layout';
import type { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { Chain } from './constant/chains';
import type { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from './screens/Home/types';
import type { DappInfo } from './core/services/dappService';
import type { HistoryDisplayItem } from './screens/Transaction/MultiAddressHistory';
import type { TransactionGroup } from './core/services/transactionHistory';
// import type { HistoryItemCateType } from './screens/Transaction/components/HistoryItemIcon';

/**
 * Learn more about using TypeScript with React Navigation:
 * https://reactnavigation.org/docs/typescript/
 */

export type RootStackParamsList = {
  [RootNames.StackRoot]?: NavigatorScreenParams<HomeNavigatorParamsList>;
  [RootNames.StackHomeNonTab]?: NavigatorScreenParams<HomeNonTabNavigatorParamsList>;
  [RootNames.StackGetStarted]?: NavigatorScreenParams<GetStartedNavigatorParamsList>;
  [RootNames.NotFound]?: {};
  [RootNames.Unlock]?: {};
  [RootNames.AccountTransaction]: NavigatorScreenParams<AccountNavigatorParamList>;
  [RootNames.StackSettings]: NavigatorScreenParams<SettingNavigatorParamList>;
  [RootNames.StackTransaction]: NavigatorScreenParams<TransactionNavigatorParamList>;
  [RootNames.StackAddress]: NavigatorScreenParams<AddressNavigatorParamList>;
  [RootNames.StackDapps]: NavigatorScreenParams<DappsNavigatorParamsList>;
  [RootNames.StackTestkits]: NavigatorScreenParams<TestKitsNavigatorParamsList>;
  [RootNames.NftDetail]: {
    token: NFTItem;
    account: KeyringAccountWithAlias;
    isSingleAddress?: boolean;
  };
  [RootNames.DeFiDetail]?: {
    data: AbstractProject;
    portfolioList: AbstractPortfolio[];
    isSingleAddress?: boolean;
    account: KeyringAccountWithAlias | null;
    cache: boolean;
    relateTokenId?: string;
  };
  [RootNames.Scanner]?: {};
  [RootNames.RestoreFromCloud]?: {};
  [RootNames.SingleAddressStack]?: NavigatorScreenParams<SingleAddressNavigatorParamList>;
  [RootNames.TokenDetail]: {
    token:
      | AbstractPortfolioToken
      | import('@/screens/Home/hooks/store').CombineTokensItem;
    fromPortfolio?: boolean;
    needUseCacheToken?: boolean;
    isSingleAddress?: boolean;
    account?: KeyringAccountWithAlias;
    unHold?: boolean;
  };
};

/**
 * @description we mock modal-like views as a stub navigator, which was implemented
 * based on the react-navigation's bottom tab navigator.
 */
export type HomeNavigatorParamsList = {
  [RootNames.Home]?: {};
  /** @deprecated */
  [RootNames.Points]?: {};
  [RootNames.DappWebViewStubOnHome]?: {
    dappsWebViewFromRoute?:
      | typeof RootNames.Dapps
      | typeof RootNames.FavoriteDapps;
    nextOpenDappInfo?: DappInfo;
  };
};

export type HomeNonTabNavigatorParamsList = {
  [RootNames.Search]?: {};
};

export type DappsNavigatorParamsList = {
  [RootNames.Dapps]?: {};
  [RootNames.FavoriteDapps]?: {};
};

type GetStartedNavigatorParamsList = {
  [RootNames.GetStarted]?: {};
  [RootNames.GetStartedScreen2024]?: {};
};

type TestKitsNavigatorParamsList = {
  [RootNames.NewUserGetStarted2024]?: {};
  [RootNames.DevUIFontShowCase]?: {};
  [RootNames.DevUIFormShowCase]?: {};
  [RootNames.DevUIAccountShowCase]?: {};
  [RootNames.DevUIScreenContainerShowCase]?: {};
  [RootNames.DevUIDapps]?: {};
  [RootNames.DevDataSQLite]?: {};
};

export type AddressNavigatorParamList = {
  [RootNames.AddressList]?: {};
  [RootNames.ReceiveAddressList]?: {};
  // [RootNames.MultiAddressHome]?: {};
  [RootNames.CreateNewAddress]?: {
    noSetupPassword?: boolean;
    useCurrentSeed?: boolean;
    mnemonics?: string;
    title?: string;
    accounts?: string[];
  };
  [RootNames.SetPassword2024]?: {
    finishGoToScreen:
      | typeof RootNames.CreateSelectMethod
      | typeof RootNames.ImportSuccess2024
      | typeof RootNames.ImportMnemonic2024
      | typeof RootNames.CreateChooseBackup
      | typeof RootNames.ImportPrivateKey2024;
    title?: string;
    hideProgress?: boolean;
    delaySetPassword?: boolean;
    hideBackIcon?: boolean;
    isFirstImportPassword?: boolean;
  };
  [RootNames.ImportSafeAddress2024]?: {};
  [RootNames.ImportWatchAddress2024]?: {};
  [RootNames.CreateSelectOnCurrentSeed]?: {};
  [RootNames.CreateSelectMethod]?: {};
  [RootNames.CreateChooseBackup]?: {
    delaySetPassword?: boolean;
  };
  [RootNames.ImportNewAddress]?: {};
  [RootNames.ImportMethods]?: {};
  [RootNames.ImportSuccess]?: {
    address: string | string[];
    brandName: string;
    deepLink?: string;
    realBrandName?: string;
    isFirstImport?: boolean;
    isFirstCreate?: boolean;
    type: KEYRING_TYPE;
    supportChainList?: Chain[];
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
    alias?: string;
    isExistedKR?: boolean;
  };
  [RootNames.ImportSuccess2024]?: {
    address: string | string[];
    brandName: string;
    deepLink?: string;
    realBrandName?: string;
    isFirstImport?: boolean;
    isFirstCreate?: boolean;
    type: KEYRING_TYPE;
    supportChainList?: Chain[];
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
    alias?: string;
    isExistedKR?: boolean;
  };
  [RootNames.ImportWatchAddress]?: {};
  [RootNames.ImportSafeAddress]?: {};
  [RootNames.AddressDetail]: {
    address: string;
    type: string;
    brandName: string;
    byImport?: string;
  };
  [RootNames.ImportMoreAddress]?: {
    type: KEYRING_TYPE;
    brand?: string;
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
    isExistedKR?: boolean;
  };
  [RootNames.ImportPrivateKey]?: {};
  [RootNames.ImportPrivateKey2024]?: {};
  [RootNames.ImportHardwareAddress]?: {};
  [RootNames.ImportMnemonic]?: {};
  [RootNames.ImportMnemonic2024]?: {};
  [RootNames.AddMnemonic]?: {};
  [RootNames.PreCreateMnemonic]?: {};
  [RootNames.CreateMnemonic]?: {};
  [RootNames.CreateMnemonicBackup]?: {};
  [RootNames.CreateMnemonicVerify]?: {};
  [RootNames.BackupPrivateKey]?: {
    data: string;
  };
  [RootNames.BackupMnemonic]?: {
    data: string;
  };
  [RootNames.RestoreFromCloud]?: {};
  [RootNames.WatchAddressList]?: {};
  [RootNames.SafeAddressList]?: {};
  [RootNames.ApprovalAddressList]?: {};
};

export type AccountNavigatorParamList = {
  [RootNames.MyBundle]?: {};
};

export type SingleAddressNavigatorParamList = {
  [RootNames.SingleAddressHome]?: {};
};

export type TransactionNavigatorParamList = {
  [RootNames.History]?: {};
  [RootNames.MultiAddressHistory]?: {
    isInTokenDetail?: boolean;
    isMultiAddress?: boolean;
    tokenItem?: AbstractPortfolioToken;
  };
  [RootNames.HistoryFilterScam]?: {};
  [RootNames.HistoryDetail]: {
    data: HistoryDisplayItem;
    isForMultipleAdderss?: boolean;
    title?: string;
  };
  [RootNames.HistoryLocalDetail]: {
    data: TransactionGroup;
    canCancel?: boolean;
    isForMultipleAdderss?: boolean;
    title?: string;
    // sendsToken: (TokenItem | undefined)[];
    // approveToken?: TokenItem;
    // formatType: HistoryItemCateType;
    // recievesToken: (TokenItem | undefined)[];
  };
  [RootNames.Send]?: {};
  [RootNames.MultiSend]?: {};
  [RootNames.SendNFT]?: {
    nftItem: NFTItem;
    collectionName?: string;
    address?: string;
  };
  [RootNames.Swap]?: {};
  [RootNames.MultiSwap]?: {};
  [RootNames.GnosisTransactionQueue]?: {};
  [RootNames.Receive]?: {};
  [RootNames.Approvals]?: {};
  [RootNames.Bridge]?: {};
  [RootNames.MultiBridge]?: {};
  [RootNames.GasAccount]?: {};
};

export type SettingNavigatorParamList = {
  [RootNames.Settings]?: {
    // enterActionType?: 'setBiometrics' | 'setAutoLockTime';
  };
  [RootNames.ProviderControllerTester]?: {};
  [RootNames.SetPassword]?:
    | {
        actionAfterSetup: 'backScreen';
        replaceStack: typeof RootNames.StackAddress;
        replaceScreen:
          | typeof RootNames.PreCreateMnemonic
          | typeof RootNames.ImportPrivateKey
          | typeof RootNames.ImportMnemonic
          | typeof RootNames.ImportMnemonic2024
          | typeof RootNames.CreateSelectMethod
          | typeof RootNames.ImportPrivateKey2024
          | typeof RootNames.ImportSuccess2024;
      }
    | {
        actionAfterSetup: 'testkits:fromSettings';
        // actionType: (SettingNavigatorParamList['Settings'] & object)['enterActionType'];
        actionType: 'setBiometrics' | 'setAutoLockTime';
      };
  [RootNames.SetBiometricsAuthentication]: {};
  [RootNames.CustomTestnet]?: {};
  [RootNames.CustomRPC]?: {
    chainId: number;
    rpcUrl: string;
  };
};

type _NestedScreensParamsDict = {
  HomeNavigatorParamsList: HomeNavigatorParamsList;
  HomeNonTabNavigatorParamsList: HomeNonTabNavigatorParamsList;
  GetStartedNavigatorParamsList: GetStartedNavigatorParamsList;
  TestKitsNavigatorParamsList: TestKitsNavigatorParamsList;
  AddressNavigatorParamList: AddressNavigatorParamList;
  AccountNavigatorParamList: AccountNavigatorParamList;
  SingleAddressNavigatorParamList: SingleAddressNavigatorParamList;
  TransactionNavigatorParamList: TransactionNavigatorParamList;
  SettingNavigatorParamList: SettingNavigatorParamList;
  DappsNavigatorParamsList: DappsNavigatorParamsList;
};
type _NestedScreensParamsName = keyof _NestedScreensParamsDict;

export type GetRootScreensParamsList<T extends keyof RootStackParamsList> =
  RootStackParamsList[T];
export type GetRootScreenNavigationProps<T extends keyof RootStackParamsList> =
  NativeStackScreenProps<RootStackParamsList, T>;

export type GetNestedScreensParamsList<
  T extends _NestedScreensParamsName,
  K extends keyof _NestedScreensParamsDict[T] & string,
> = _NestedScreensParamsDict[T][K];
export type GetNestedScreenNavigationProps<
  T extends _NestedScreensParamsName,
  K extends keyof _NestedScreensParamsDict[T] & string,
> = CompositeScreenProps<
  NativeStackScreenProps<_NestedScreensParamsDict[T], K>,
  NativeStackScreenProps<RootStackParamsList>
>;
