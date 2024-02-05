const NetTypes = {
  mainnet: 'Mainnets',
  testnet: 'Testnets',
} as const;

export type NetSwitchTabsKey = keyof typeof NetTypes;
