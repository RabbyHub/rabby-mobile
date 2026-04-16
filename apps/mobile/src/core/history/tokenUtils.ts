import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export const fetchHistoryTokenUUId = (
  tokenId: string,
  chain: string,
): string => {
  return `${chain}_token:${tokenId}`;
};

export const fetchHistoryTokenItem = (
  tokenId: string,
  chain: string,
  tokenDict: Record<string, TokenItem>,
) => {
  const tokenUUID = fetchHistoryTokenUUId(tokenId, chain);
  return tokenDict[tokenUUID] || tokenDict[tokenId] || ({} as TokenItem);
};

export const isNFTTokenId = (tokenId: string) => {
  return tokenId.length === 32;
};
