import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export const isNFTTokenId = (tokenId: string) => {
  return tokenId.length === 32;
};

export const fetchHistoryTokenUUId = (
  token_id: string,
  chain: string,
): string => {
  return `${chain}_token:${token_id}`;
};

export const fetchHistoryTokenItem = (
  token_id: string,
  chain: string,
  tokenDict: Record<string, TokenItem>,
) => {
  const tokenUUID = `${chain}_token:${token_id}`;
  return tokenDict[tokenUUID] || tokenDict[token_id] || {};
};
