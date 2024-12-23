import { preferenceService } from '@/core/services';

export const getTokenSettings = async (address: string) => {
  const { includeDefiAndTokens, excludeDefiAndTokens } =
    await preferenceService.getUserTokenSettings(address);
  const included_token_uuids =
    includeDefiAndTokens
      ?.filter(i => i.type === 'token')
      ?.map(item => `${item.chainid}:${item.id}`) || [];
  const excluded_token_uuids =
    excludeDefiAndTokens
      ?.filter(i => i.type === 'token')
      ?.map(item => `${item.chainid}:${item.id}`) || [];
  const excluded_protocol_ids =
    excludeDefiAndTokens?.filter(i => i.type === 'defi').map(i => i.id) || [];
  return {
    included_token_uuids,
    excluded_token_uuids,
    excluded_protocol_ids,
    excluded_chain_ids: [],
  };
};
