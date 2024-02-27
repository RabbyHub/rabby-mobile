import { NavigatorScreenParams } from '@react-navigation/native';
import {} from '@react-navigation/bottom-tabs';

import { RootNames } from './constant/layout';

/**
 * Learn more about using TypeScript with React Navigation:
 * https://reactnavigation.org/docs/typescript/
 */

export type RootStackParamsList = {
  [RootNames.StackRoot]?: NavigatorScreenParams<BottomTabParamsList>;
  [RootNames.StackGetStarted]?: NavigatorScreenParams<GetStartedNavigatorParamsList>;
  [RootNames.NotFound]?: {};
  [RootNames.Receive]?: {};
  [RootNames.AccountTransaction]: NavigatorScreenParams<AccountNavigatorParamList>;
  [RootNames.StackSettings]: NavigatorScreenParams<SettingNavigatorParamList>;
  [RootNames.StackTransaction]: NavigatorScreenParams<TransactionNavigatorParamList>;
  [RootNames.StackAddress]: NavigatorScreenParams<AddressNavigatorParamList>;
  [RootNames.StackFavoritePopularDapps]: NavigatorScreenParams<FavoritePopularDappsNavigatorParamList>;
  [RootNames.StackSearchDapps]: NavigatorScreenParams<SearchDappsNavigatorParamList>;
  [RootNames.NftDetail]?: {};
  [RootNames.ImportLedger]?: {};
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
    address: string;
    brandName: string;
    deepLink?: string;
    realBrandName?: string;
  };
  [RootNames.ImportWatchAddress]?: {};
  [RootNames.AddressDetail]: {
    address: string;
    type: string;
    brandName: string;
    byImport?: string;
  };
};

export type AccountNavigatorParamList = {
  [RootNames.MyBundle]?: {};
};

export type TransactionNavigatorParamList = {
  [RootNames.History]?: {};
  [RootNames.HistoryFilterScam]?: {};
  [RootNames.Send]?: {};
};

export type SettingNavigatorParamList = {
  [RootNames.Settings]?: {};
  [RootNames.ProviderControllerTester]?: {};
};

export type FavoritePopularDappsNavigatorParamList = {
  [RootNames.FavoritePopularDapps]?: {};
};

export type SearchDappsNavigatorParamList = {
  [RootNames.SearchDapps]?: {};
};
