export const PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME =
  'IDX_cache_portocolitem_projection_resource_id';

export function buildProtocolProjectionResourceId(
  ownerAddress: string,
  chain: string,
  protocolId: string,
) {
  return [ownerAddress, chain, protocolId]
    .map(value => value.toLowerCase())
    .join(':');
}
