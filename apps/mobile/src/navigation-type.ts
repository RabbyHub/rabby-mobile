import { NavigatorScreenParams } from '@react-navigation/native';
import {} from '@react-navigation/bottom-tabs';

import { AppRootName, RootNames } from './constant/layout';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Chain } from './constant/chains';

/**
 * Learn more about using TypeScript with React Navigation:
 * https://reactnavigation.org/docs/typescript/
 */

export type RootStackParamsList = {
  [RootNames.StackRoot]?: NavigatorScreenParams<BottomTabParamsList>;
  [RootNames.StackGetStarted]?: NavigatorScreenParams<GetStartedNavigatorParamsList>;
  [RootNames.NotFound]?: {};
  [RootNames.Unlock]?: {};
  [RootNames.AccountTransaction]: NavigatorScreenParams<AccountNavigatorParamList>;
  [RootNames.StackSettings]: NavigatorScreenParams<SettingNavigatorParamList>;
  [RootNames.StackTransaction]: NavigatorScreenParams<TransactionNavigatorParamList>;
  [RootNames.StackAddress]: NavigatorScreenParams<AddressNavigatorParamList>;
  [RootNames.StackFavoritePopularDapps]: NavigatorScreenParams<FavoritePopularDappsNavigatorParamList>;
  [RootNames.StackSearchDapps]: NavigatorScreenParams<SearchDappsNavigatorParamList>;
  [RootNames.NftDetail]?: {};
  [RootNames.ImportMoreAddress]?: {
    type: KEYRING_TYPE;
    brand?: string;
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
    isExistedKR?: boolean;
  };
  [RootNames.Scanner]?: {};
};

export type BottomTabParamsList = {
  [RootNames.Home]?: {};
  [RootNames.Dapps]?: {};
  [RootNames.Points]?: {};
};

type GetStartedNavigatorParamsList = {
  [RootNames.GetStarted]?: {};
};

export type AddressNavigatorParamList = {
  [RootNames.CurrentAddress]?: {};
  [RootNames.ImportNewAddress]?: {};
  [RootNames.ImportSuccess]?: {
    address: string | string[];
    brandName: string;
    deepLink?: string;
    realBrandName?: string;
    isFirstImport?: boolean;
    type: KEYRING_TYPE;
    supportChainList?: Chain[];
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
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
  [RootNames.ImportPrivateKey]?: {};
  [RootNames.ImportMnemonic]?: {};
  [RootNames.AddMnemonic]?: {};
  [RootNames.CreateMnemonic]?: {};
  [RootNames.CreateMnemonicBackup]?: {};
  [RootNames.CreateMnemonicVerify]?: {};
  [RootNames.BackupPrivateKey]?: {
    data: string;
  };
  [RootNames.BackupMnemonic]?: {
    data: string;
  };
};

export type AccountNavigatorParamList = {
  [RootNames.MyBundle]?: {};
};

export type TransactionNavigatorParamList = {
  [RootNames.History]?: {};
  [RootNames.HistoryFilterScam]?: {};
  [RootNames.Send]?: {};
  [RootNames.Swap]?: {};
  [RootNames.GnosisTransactionQueue]?: {};
  [RootNames.Receive]?: {};
  [RootNames.Approvals]?: {};
  [RootNames.GasTopUp]?: {};
};

export type SettingNavigatorParamList = {
  [RootNames.Settings]?: {};
  [RootNames.ProviderControllerTester]?: {};
  [RootNames.SetPassword]?: {
    replaceStack: typeof RootNames.StackAddress;
    replaceScreen:
      | typeof RootNames.CreateMnemonic
      | typeof RootNames.ImportPrivateKey
      | typeof RootNames.ImportMnemonic;
  };
  [RootNames.SetBiometricsAuthentication]: {};
  [RootNames.CustomTestnet]?: {};
};

export type FavoritePopularDappsNavigatorParamList = {
  [RootNames.FavoritePopularDapps]?: {};
};

export type SearchDappsNavigatorParamList = {
  [RootNames.SearchDapps]?: {};
};
