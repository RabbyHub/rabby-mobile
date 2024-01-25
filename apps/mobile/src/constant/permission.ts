export enum SIGN_PERMISSION_TYPES {
  MAINNET_AND_TESTNET = 'MAINNET_AND_TESTNET',
  TESTNET = 'TESTNET',
}
export const SIGN_PERMISSION_OPTIONS = [
  {
    label: 'Mainnet & Testnet',
    value: SIGN_PERMISSION_TYPES.MAINNET_AND_TESTNET,
  },
  {
    label: 'Only Testnets',
    value: SIGN_PERMISSION_TYPES.TESTNET,
  },
];
