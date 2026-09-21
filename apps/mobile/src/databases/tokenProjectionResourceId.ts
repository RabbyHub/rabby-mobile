export const TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME =
  'IDX_cache_tokenitem_projection_resource_id';

export const buildTokenProjectionResourceId = (
  ownerAddress: string,
  chain: string,
  tokenId: string,
) => [ownerAddress, chain, tokenId].map(value => value.toLowerCase()).join(':');
