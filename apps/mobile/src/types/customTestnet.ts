import type { CHAINS_ENUM } from '@debank/common';

export interface TestnetChainBase {
  id: number;
  name: string;
  nativeTokenSymbol: string;
  rpcUrl: string;
  scanLink?: string;
}

export interface TestnetChain extends TestnetChainBase {
  nativeTokenAddress: string;
  hex: string;
  network: string;
  enum: CHAINS_ENUM;
  serverId: string;
  nativeTokenLogo: string;
  eip: Record<string, any>;
  nativeTokenDecimals: number;
  scanLink: string;
  isTestnet?: boolean;
  logo: string;
  whiteLogo?: string;
  needEstimateGas?: boolean;
  severity: number;
}

export interface CustomTestnetTokenBase {
  id: string;
  chainId: number;
  symbol: string;
  decimals: number;
}

export interface CustomTestnetToken extends CustomTestnetTokenBase {
  amount: number;
  rawAmount: string;
}
