import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';

import { KeyringAccountWithAlias } from '@/hooks/account';
import {} from '@react-navigation/bottom-tabs';

import type { RootNames } from './constant/layout';
import type {
  DisplayedKeyring,
  DisplayKeyring,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import type { Chain, CHAINS_ENUM } from './constant/chains';
import type {
  CopyTradeTokenItemV2,
  NFTItem,
  SendAction,
  TokenItem,
  TransferingNFTItem,
} from '@rabby-wallet/rabby-api/dist/types';
import type {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from './screens/Home/types';
import type { DappInfo } from './core/services/dappService';
import type { HistoryDisplayItem } from './screens/Transaction/MultiAddressHistory';
import type { TransactionGroup } from './core/services/transactionHistory';
import { Account } from './core/services/preference';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
} from './screens/Approvals/useApprovalsPage';
import { HistoryItemCateType } from './screens/Transaction/components/type';
import type { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { ITokenItem } from './store/tokens';

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
  [RootNames.StackBrowser]: NavigatorScreenParams<BrowserNavigatorParamsList>;
  [RootNames.StackTestkits]: NavigatorScreenParams<TestKitsNavigatorParamsList>;
  [RootNames.NftDetail]: {
    token: NFTItem | TransferingNFTItem | TokenItem | TokenItem[];
    account?: KeyringAccountWithAlias;
    isSingleAddress?: boolean;
  };
  [RootNames.DeFiDetail]?: {
    data: AbstractProject;
    portfolioList: AbstractPortfolio[];
    rawPortfolios?: AbstractProject[];
    isSingleAddress?: boolean;
    account?: KeyringAccountWithAlias | null;
    cache: boolean;
    relateTokenId?: string;
  };
  [RootNames.Scanner]?: {
    syncExtension?: boolean;
    /** @description for some scene scan in place, such as scan from modal */
    disableGoBack?: boolean;
  };
  [RootNames.RestoreFromCloud]?: {};
  [RootNames.SingleAddressStack]?: NavigatorScreenParams<SingleAddressNavigatorParamList>;
  [RootNames.TokenDetail]: {
    token: ITokenItem;
    fromPortfolio?: boolean;
    needUseCacheToken?: boolean;
    isSingleAddress?: boolean;
    account?: KeyringAccountWithAlias | null;
    rawPortfolios?: AbstractProject[]; // only for single address
    unHold?: boolean;
    isSwapToTokenDetail?: boolean;
    tokenSelectType?: import('@/components/Token/TokenSelectorSheetModal').TokenSelectType;
  };
  [RootNames.TokenMarketInfo]: {
    token: ITokenItem;
    fromPortfolio?: boolean;
    needUseCacheToken?: boolean;
    isSingleAddress?: boolean;
    account?: KeyringAccountWithAlias | null;
    rawPortfolios?: AbstractProject[]; // only for single address
    unHold?: boolean;
    isSwapToTokenDetail?: boolean;
    tokenSelectType?: import('@/components/Token/TokenSelectorSheetModal').TokenSelectType;
  };
};

/**
 * @description we mock modal-like views as a stub navigator, which was implemented
 * based on the react-navigation's bottom tab navigator.
 */
export type HomeNavigatorParamsList = {
  [RootNames.Home]?: {};
  /** @deprecated */
  [RootNames.DappWebViewStubOnHome]?: {
    dappsWebViewFromRoute?:
      | typeof RootNames.Dapps
      | typeof RootNames.FavoriteDapps
      | 'back';
    nextOpenDappInfo?: DappInfo;
  };
};

export type HomeNonTabNavigatorParamsList = {
  [RootNames.Search]?: {};
  [RootNames.Watchlist]?: {};
};

export type DappsNavigatorParamsList = {
  [RootNames.Dapps]?: {};
  [RootNames.FavoriteDapps]?: {};
};

export type BrowserNavigatorParamsList = {
  [RootNames.BrowserScreen]?: {};
  [RootNames.BrowserManageScreen]?: {};
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
  [RootNames.DevUIBuiltInPages]?: {};
  [RootNames.DevUIPermissions]?: {};
  [RootNames.DevSwitches]?: {};
  [RootNames.DevPerf]?: {};
};

export type AddressNavigatorParamList = {
  [RootNames.AddressList]?: {};
  [RootNames.ReceiveAddressList]?: {
    tokenSymbol?: string;
    chainEnum?: CHAINS_ENUM;
  };
  // [RootNames.MultiAddressHome]?: {};
  [RootNames.CreateNewAddress]?: {
    noSetupPassword?: boolean;
    useCurrentSeed?: boolean;
    mnemonics?: string;
    title?: string;
    accounts?: string[];
    isFirstCreate?: boolean;
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
    isFirstCreate?: boolean;
  };
  [RootNames.ImportSafeAddress2024]?: {};
  [RootNames.ImportWatchAddress2024]?: {};
  [RootNames.CreateSelectMethod]?: {};
  [RootNames.CreateChooseBackup]?: {
    delaySetPassword?: boolean;
    isFirstCreate?: boolean;
  };
  [RootNames.ImportNewAddress]?: {};
  [RootNames.ImportMethods]?: {
    isNotNewUserProc?: boolean; // if has address
    isFromEmptyAddress?: boolean;
  };
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
  [RootNames.RestoreFromCloud]?: {};
  [RootNames.WatchAddressList]?: {};
  [RootNames.SafeAddressList]?: {};
  [RootNames.ApprovalAddressList]?: {};
  [RootNames.SyncExtensionPassword]?: {};
  [RootNames.SyncExtensionAccountSuccess]?: {
    newAccounts: Account[];
  };
  [RootNames.Points]?: {};
};

export type AccountNavigatorParamList = {
  [RootNames.MyBundle]?: {};
};

export type SingleAddressNavigatorParamList = {
  [RootNames.SingleAddressHome]: {
    // account: Account;
  };
};

export type TransactionNavigatorParamList = {
  [RootNames.History]?: {};
  [RootNames.MultiAddressHistory]?: {
    isInTokenDetail?: boolean;
    isMultiAddress?: boolean;
    tokenItem?: AbstractPortfolioToken;
    currentAddress?: string;
  };
  [RootNames.LendingHistory]?: {};
  [RootNames.HistoryDetail]: {
    data: HistoryDisplayItem;
    isForMultipleAddress?: boolean;
    title?: string;
  };
  [RootNames.HistoryLocalDetail]: {
    data: TransactionGroup;
    canCancel?: boolean;
    isForMultipleAddress?: boolean;
    title?: string;
    type?: HistoryItemCateType;
    onPressAddToWhitelistButton?: (data: SendAction) => void;
    isInSendHistory?: boolean;
  };
  [RootNames.Send]?:
    | {
        chainEnum?: CHAINS_ENUM | undefined;
        tokenId?: TokenItem['id'];
        toAddress?: string;
        addressBrandName?: string;
        addrDesc?: AddrDescResponse['desc'];
      }
    | {
        safeInfo: { nonce: number; chainId: number };
        toAddress?: string;
        addressBrandName?: string;
        addrDesc?: AddrDescResponse['desc'];
      };
  [RootNames.MultiSend]?: TransactionNavigatorParamList['Send'] & object;
  [RootNames.SendNFT]: {
    nftItem: NFTItem;
    collectionName?: string;
    fromAddress?: string;
    fromAccount?: Account;
    toAddress?: string;
    addressBrandName?: string;
    addrDesc?: AddrDescResponse['desc'];
  };
  [RootNames.Swap]?: {
    chainEnum?: CHAINS_ENUM | undefined;
    tokenId?: TokenItem['id'];
    type?: 'Buy' | 'Sell';
    address?: string;
    swapAgain?: boolean;
    swapTokenId?: TokenItem['id'][];
    isSwapToTokenDetail?: boolean;
    isFromSwap?: boolean;
    isFromCopyTrading?: boolean;
  };
  [RootNames.MultiSwap]?: TransactionNavigatorParamList['Swap'] & object;
  [RootNames.GnosisTransactionQueue]: {
    account: Account;
  };
  [RootNames.Receive]: {
    account: Account;
    tokenSymbol?: string;
    chainEnum?: CHAINS_ENUM;
  };
  [RootNames.Approvals]: {
    account: Account;
  };
  [RootNames.Bridge]?: {
    chainEnum?: CHAINS_ENUM | undefined;
    tokenId?: TokenItem['id'];
    toChainEnum?: CHAINS_ENUM;
    toTokenId?: TokenItem['id'];
  };
  [RootNames.MultiBridge]?: TransactionNavigatorParamList['Bridge'] & object;
  [RootNames.GasAccount]?: {};
  [RootNames.BatchRevoke]: {
    revokeList: ApprovalSpenderItemToBeRevoked[];
    dataSource: AssetApprovalSpender[];
    account: Account;
  };

  [RootNames.Perps]?: {
    account?: KeyringAccountWithAlias;
    fromName?: string;
  };
  [RootNames.PerpsMarketList]?: {};
  [RootNames.PerpsHistory]?: {
    coin?: string;
  };
  [RootNames.PerpsMarketDetail]: {
    market: string;
    fromSource?: string;
    showOpenPosition?: boolean;
  };
  [RootNames.Lending]?: {
    tokenAddress?: string;
    direction?: 'supply' | 'borrow';
  };
};

export type SettingNavigatorParamList = {
  [RootNames.Settings]?: {
    // enterActionType?: 'setBiometrics' | 'setAutoLockExpireTime';
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
        actionType: 'setBiometrics' | 'setAutoLockExpireTime';
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

export type GetRootScreenRouteProp<T extends keyof RootStackParamsList> =
  RouteProp<RootStackParamsList, T>;
export type GetRootScreensParamsList<T extends keyof RootStackParamsList> =
  RootStackParamsList[T];
export type GetRootScreenNavigationProps<T extends keyof RootStackParamsList> =
  NativeStackScreenProps<RootStackParamsList, T>;

export type GetNestedScreensParamsList<
  T extends _NestedScreensParamsName,
  K extends keyof _NestedScreensParamsDict[T] & string,
> = _NestedScreensParamsDict[T][K];

/** @deprecated use `GetNestedScreenRouteProp` directly */
export type GetNestedScreenNavigationProps<
  T extends _NestedScreensParamsName,
  K extends keyof _NestedScreensParamsDict[T] & string,
> = CompositeScreenProps<
  // @ts-expect-error
  NativeStackScreenProps<_NestedScreensParamsDict[T], K>,
  NativeStackScreenProps<RootStackParamsList>
>;
export type GetNestedScreenRouteProp<
  T extends _NestedScreensParamsName,
  K extends keyof _NestedScreensParamsDict[T] & string,
> = RouteProp<_NestedScreensParamsDict[T], K>;
