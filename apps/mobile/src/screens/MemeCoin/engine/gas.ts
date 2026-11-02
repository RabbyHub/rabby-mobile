import BigNumber from 'bignumber.js';
import {
  DEFAULT_MAINNET_PER_LEG_GAS_USD,
  DEFAULT_PER_LEG_GAS_USD,
  ETH_MAINNET_SERVER_ID,
} from './constants';
import type { ChainGasInfo } from './types';

export const defaultPerLegGasUsd = (chainServerId: string) =>
  chainServerId === ETH_MAINNET_SERVER_ID
    ? DEFAULT_MAINNET_PER_LEG_GAS_USD
    : DEFAULT_PER_LEG_GAS_USD;

export const gasReserveInNativeUnits = ({
  gasLimit,
  gasPriceWei,
  nativeDecimals,
}: {
  gasLimit: number;
  gasPriceWei: number;
  nativeDecimals: number;
}) =>
  new BigNumber(gasLimit)
    .times(gasPriceWei)
    .div(new BigNumber(10).pow(nativeDecimals));

export const toChainGasInfo = ({
  gasLimit,
  gasPriceWei,
  nativeDecimals,
  nativePrice,
  nativeBalanceUsd,
  bridgeSupported,
}: {
  gasLimit: number;
  gasPriceWei: number;
  nativeDecimals: number;
  nativePrice: number;
  nativeBalanceUsd: number;
  bridgeSupported: boolean;
}): ChainGasInfo => ({
  perLegGasUsd: gasReserveInNativeUnits({
    gasLimit,
    gasPriceWei,
    nativeDecimals,
  })
    .times(nativePrice)
    .toNumber(),
  nativeBalanceUsd,
  bridgeSupported,
});
