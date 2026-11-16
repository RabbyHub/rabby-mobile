import BigNumber from 'bignumber.js';
import type { ChainGasInfo } from './types';

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
