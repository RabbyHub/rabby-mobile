export enum MultiHomeFeatTitle {
  Send = 'Send',
  Receive = 'Receive',
  Swap = 'Swap',
  Bridge = 'Bridge',
  History = 'Transactions',
  Approvals = 'Approvals',
  GasAccount = 'GasAccount',
  Dapps = 'Dapps',
  Ecosystem = 'Ecosystem',
  Points = 'Rabby Points',
  Predict = 'Predict',
  Buy = 'Buy',
  Search = 'Search',
  Watchlist = 'Watchlist',
  Meme = 'Meme',
  Perps = 'Perps',
  Lending = 'Lending',
  /** @deprecated */
  TEST_DAPP = 'TEST_DAPP',
}

export enum AccountPannelSectionTitle {
  MyAddresses = 'My Addresses',
  SafeAddresses = 'Safe Addresses',
  WatchAddresses = 'Watch Addresses',
}

export enum TxAccountPannelSectionTitle {
  Recent = 'Recent',
  Whitelist = 'Whitelist',
  MyAddresses = 'My Addresses',
  SafeAddresses = 'Safe Addresses',
  WatchAddresses = 'Watch Addresses',
}

export type HomeFeatureNewTagConfig = {
  enableNewTag: boolean;
};

export const HOME_FEATURE_NEW_TAG_CONFIG: Partial<
  Record<MultiHomeFeatTitle, HomeFeatureNewTagConfig>
> = {
  // 配置是否显示NEW标签在这里
  [MultiHomeFeatTitle.Meme]: {
    enableNewTag: true,
  },
};
