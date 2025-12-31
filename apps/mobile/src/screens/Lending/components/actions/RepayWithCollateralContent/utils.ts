import { MarketDataType } from '@/screens/Lending/config/market';
import { SupportedChainId } from '@/screens/Lending/utils/native';

export const DEFAULT_REPAY_WITH_COLLATERAL_SLIPPAGE = 100; // 1%

const REPAY_WITH_COLLATERAL_SUPPORTED_CHAINs = [
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.AVALANCHE,
  SupportedChainId.BNB,
  SupportedChainId.GNOSIS_CHAIN,
  SupportedChainId.MAINNET,
  SupportedChainId.POLYGON,
  SupportedChainId.SEPOLIA,
];
export const isSupportRepayWithCollateral = (
  chainId: number,
  market?: MarketDataType,
) => {
  const marketEnabledFeatures =
    market &&
    market.enabledFeatures?.collateralRepay &&
    market.addresses.REPAY_WITH_COLLATERAL_ADAPTER;
  return (
    REPAY_WITH_COLLATERAL_SUPPORTED_CHAINs.includes(chainId) &&
    marketEnabledFeatures
  );
};
