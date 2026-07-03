import type { ITokenItem } from '@/types/assets';
import type {
  CustomTestnetTokenBase,
  TestnetChain,
} from '@/types/customTestnet';

export type CustomTestnetAssetSectionToken = Pick<
  CustomTestnetTokenBase,
  'id' | 'chainId' | 'symbol' | 'decimals'
> & {
  isNative?: boolean;
};

export type CustomTestnetAssetSectionData = {
  chain: TestnetChain;
  tokens: CustomTestnetAssetSectionToken[];
  ownerAddresses: string[];
};

export type LoadCustomTestnetAssetTokensParams = {
  chain: TestnetChain;
  tokens: CustomTestnetAssetSectionToken[];
};

export type LoadCustomTestnetAssetTokens = (
  params: LoadCustomTestnetAssetTokensParams,
) => Promise<ITokenItem[]>;

export type LoadCustomTestnetAssetTokenParams = {
  chain: TestnetChain;
  token: CustomTestnetAssetSectionToken;
};

export type LoadCustomTestnetAssetToken = (
  params: LoadCustomTestnetAssetTokenParams,
) => Promise<ITokenItem[]>;
