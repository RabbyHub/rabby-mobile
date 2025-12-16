import { useMemo } from 'react';
import { SwappableToken } from '../../types/swap';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useLendingSummary } from '../../hooks';
import { constants } from 'ethers';
import BigNumber from 'bignumber.js';

export const useFormatValues = ({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: {
  fromToken: SwappableToken;
  toToken?: SwappableToken;
  fromAmount: string;
  toAmount: string;
}) => {
  const fromBalanceBn = useMemo(() => {
    return new BigNumber(fromToken?.balance || 0);
  }, [fromToken]);

  const fromBalanceDisplay = useMemo(() => {
    return formatTokenAmount(fromBalanceBn.toString(10));
  }, [fromBalanceBn]);

  const fromUsdValue = useMemo(() => {
    const usdPrice = new BigNumber(fromToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(fromAmount || 0).times(usdPrice).toString(10),
    );
  }, [fromAmount, fromToken?.usdPrice]);

  const toUsdValue = useMemo(() => {
    if (!toToken) {
      return formatUsdValue(0);
    }
    const usdPrice = new BigNumber(toToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(toAmount || 0).times(usdPrice).toString(10),
    );
  }, [toAmount, toToken]);
  return {
    fromBalanceDisplay,
    fromUsdValue,
    toUsdValue,
    fromBalanceBn,
  };
};

export const useSwapReserves = ({
  fromToken,
  toToken,
}: {
  fromToken: SwappableToken;
  toToken?: SwappableToken;
}) => {
  const { formattedPoolReservesAndIncentives } = useLendingSummary();
  const fromReserve = useMemo(
    () =>
      formattedPoolReservesAndIncentives?.find(item =>
        isSameAddress(item.underlyingAsset, fromToken.underlyingAddress),
      ),
    [formattedPoolReservesAndIncentives, fromToken.underlyingAddress],
  );

  const toReserve = useMemo(
    () =>
      formattedPoolReservesAndIncentives?.find(item =>
        isSameAddress(
          item.underlyingAsset,
          toToken?.underlyingAddress || constants.AddressZero,
        ),
      ),
    [formattedPoolReservesAndIncentives, toToken?.underlyingAddress],
  );

  const isSameToken = useMemo(() => {
    if (!toToken) {
      return false;
    }
    return isSameAddress(
      toToken.underlyingAddress,
      fromToken.underlyingAddress,
    );
  }, [fromToken.underlyingAddress, toToken]);
  return {
    fromReserve,
    toReserve,
    isSameToken,
  };
};
