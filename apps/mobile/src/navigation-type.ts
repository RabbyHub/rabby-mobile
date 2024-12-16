import { KeyringAccountWithAlias } from '@/hooks/account';
import { NavigatorScreenParams } from '@react-navigation/native';
import {} from '@react-navigation/bottom-tabs';

import { AppRootName, RootNames } from './constant/layout';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Chain, CHAINS_ENUM } from './constant/chains';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken } from './screens/Home/types';

/**
 * Learn more about using TypeScript with React Navigation:
 * https://reactnavigation.org/docs/typescript/
 */

export type RootStackParamsList = {
  [RootNames.StackRoot]?: NavigatorScreenParams<RootNavigatorParamsList>;
  [RootNames.StackGetStarted]?: NavigatorScreenParams<GetStartedNavigatorParamsList>;
  [RootNames.NotFound]?: {};
  [RootNames.Unlock]?: {};
  [RootNames.AccountTransaction]: NavigatorScreenParams<AccountNavigatorParamList>;
  [RootNames.StackSettings]: NavigatorScreenParams<SettingNavigatorParamList>;
  [RootNames.StackTransaction]: NavigatorScreenParams<TransactionNavigatorParamList>;
  [RootNames.StackAddress]: NavigatorScreenParams<AddressNavigatorParamList>;
  [RootNames.StackFavoriteDapps]: NavigatorScreenParams<FavoriteDappsNavigatorParamList>;
  [RootNames.StackTestkits]: NavigatorScreenParams<TestKitsNavigatorParamsList>;
  [RootNames.NftDetail]?: {};
  [RootNames.Scanner]?: {};
  [RootNames.RestoreFromCloud]?: {};
  [RootNames.SingleAddressStack]?: NavigatorScreenParams<SingleAddressNavigatorParamList>;
  [RootNames.TokenDetail]: {
    token: AbstractPortfolioToken;
    account?: KeyringAccountWithAlias;
  };
};

export type RootNavigatorParamsList = {
  [RootNames.Home]?: {};
  /** @deprecated */
  [RootNames.Points]?: {};
  [RootNames.Dapps]?: {};
  [RootNames.Settings]?: {
    // enterActionType?: 'setBiometrics' | 'setAutoLockTime';
  };
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
};

export type AddressNavigatorParamList = {
  [RootNames.AddressList]?: {};
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
  [RootNames.MultiAddressHistory]?: {};
  [RootNames.HistoryFilterScam]?: {};
  [RootNames.Send]?: {};
  [RootNames.MultiSend]?: {};
  [RootNames.SendNFT]?: {
    nftItem: NFTItem;
    collectionName?: string;
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
        actionAfterSetup: 'onSettings';
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

export type FavoriteDappsNavigatorParamList = {
  [RootNames.FavoriteDapps]?: {};
};
