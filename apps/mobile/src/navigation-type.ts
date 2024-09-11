import { NavigatorScreenParams } from '@react-navigation/native';
import {} from '@react-navigation/bottom-tabs';

import { AppRootName, RootNames } from './constant/layout';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Chain, CHAINS_ENUM } from './constant/chains';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';

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
  [RootNames.RestoreFromCloud]?: {};
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
};

export type AccountNavigatorParamList = {
  [RootNames.MyBundle]?: {};
};

export type TransactionNavigatorParamList = {
  [RootNames.History]?: {};
  [RootNames.HistoryFilterScam]?: {};
  [RootNames.Send]?: {};
  [RootNames.SendNFT]?: {
    nftItem: NFTItem;
    collectionName?: string;
  };
  [RootNames.Swap]?: {};
  [RootNames.GnosisTransactionQueue]?: {};
  [RootNames.Receive]?: {};
  [RootNames.Approvals]?: {};
  [RootNames.GasTopUp]?: {};
  [RootNames.Bridge]?: {};
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
          | typeof RootNames.ImportMnemonic;
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

export type FavoritePopularDappsNavigatorParamList = {
  [RootNames.FavoritePopularDapps]?: {};
};

export type SearchDappsNavigatorParamList = {
  [RootNames.SearchDapps]?: {};
};
