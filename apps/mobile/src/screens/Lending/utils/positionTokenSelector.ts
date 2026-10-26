import { formatTokenAmount } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CHAINS_ENUM } from '@debank/common';

import type { DisplayPoolReserveInfo } from '../type';
import wrapperToken from '../config/wrapperToken';
import { API_ETH_MOCK_ADDRESS } from './constant';

export type BasicPositionTokenOption = {
  underlyingAsset: string;
  symbol: string;
};

export type BalancePositionTokenOption = BasicPositionTokenOption & {
  balanceText: string;
};

export type PositionTokenOption =
  | BasicPositionTokenOption
  | BalancePositionTokenOption;

export const getPositionTokenBalanceText = (balance?: string) => {
  const balanceNum = Number(balance || '0');
  if (!balanceNum) {
    return '0';
  }

  const tokenAmount =
    balanceNum >= 1 ? balanceNum.toFixed(4) : balanceNum.toPrecision(4);

  return formatTokenAmount(tokenAmount);
};

export const getWrappedNativeAddress = (chainEnum?: CHAINS_ENUM) => {
  return chainEnum ? wrapperToken?.[chainEnum]?.address : undefined;
};

export const isNativeTokenReserve = (item?: DisplayPoolReserveInfo | null) => {
  return item
    ? isSameAddress(item.underlyingAsset, API_ETH_MOCK_ADDRESS)
    : false;
};

export const isWrappedNativeTokenReserve = (
  item?: DisplayPoolReserveInfo | null,
  chainEnum?: CHAINS_ENUM,
) => {
  const wrappedNativeAddress = getWrappedNativeAddress(chainEnum);
  return item && wrappedNativeAddress
    ? isSameAddress(item.underlyingAsset, wrappedNativeAddress)
    : false;
};

export const getWrappedNativeReservePair = (
  displayPoolReserves?: DisplayPoolReserveInfo[],
  chainEnum?: CHAINS_ENUM,
) => {
  const wrappedNativeAddress = getWrappedNativeAddress(chainEnum);
  const nativeReserve = displayPoolReserves?.find(item =>
    isNativeTokenReserve(item),
  );
  const wrappedReserve = wrappedNativeAddress
    ? displayPoolReserves?.find(item =>
        isSameAddress(item.underlyingAsset, wrappedNativeAddress),
      )
    : undefined;

  return {
    nativeReserve,
    wrappedReserve,
  };
};

export const isWrappedNativeSelectorReserve = (
  item?: DisplayPoolReserveInfo | null,
  chainEnum?: CHAINS_ENUM,
) => {
  return (
    isNativeTokenReserve(item) || isWrappedNativeTokenReserve(item, chainEnum)
  );
};

export function getWrappedNativeTokenOptions({
  displayPoolReserves,
  chainEnum,
  type,
}: {
  displayPoolReserves?: DisplayPoolReserveInfo[];
  chainEnum?: CHAINS_ENUM;
  type?: 'default';
}): BasicPositionTokenOption[] | undefined;
export function getWrappedNativeTokenOptions({
  displayPoolReserves,
  chainEnum,
  type,
}: {
  displayPoolReserves?: DisplayPoolReserveInfo[];
  chainEnum?: CHAINS_ENUM;
  type: 'balance';
}): BalancePositionTokenOption[] | undefined;
export function getWrappedNativeTokenOptions({
  displayPoolReserves,
  chainEnum,
  type = 'default',
}: {
  displayPoolReserves?: DisplayPoolReserveInfo[];
  chainEnum?: CHAINS_ENUM;
  type?: 'default' | 'balance';
}) {
  const { nativeReserve, wrappedReserve } = getWrappedNativeReservePair(
    displayPoolReserves,
    chainEnum,
  );

  if (!nativeReserve || !wrappedReserve) {
    return undefined;
  }

  const options = [
    {
      underlyingAsset: nativeReserve.underlyingAsset,
      symbol: nativeReserve.reserve.symbol,
      balanceText: getPositionTokenBalanceText(nativeReserve.walletBalance),
    },
    {
      underlyingAsset: wrappedReserve.underlyingAsset,
      symbol: wrappedReserve.reserve.symbol,
      balanceText: getPositionTokenBalanceText(wrappedReserve.walletBalance),
    },
  ];

  if (type === 'balance') {
    return options;
  }

  return options.map(({ underlyingAsset, symbol }) => ({
    underlyingAsset,
    symbol,
  }));
}
