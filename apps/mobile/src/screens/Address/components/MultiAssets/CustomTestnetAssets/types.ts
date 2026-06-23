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
};

export type LoadCustomTestnetAssetTokensParams = {
  chainId: number;
};

export type LoadCustomTestnetAssetTokens = (
  params: LoadCustomTestnetAssetTokensParams,
) => Promise<ITokenItem[]>;
