import { getUserTokenSettings } from '@/core/serviceApi/preference';

export const getTokenSettings = async () => {
  const { includeDefiAndTokens, excludeDefiAndTokens } =
    await getUserTokenSettings();
  const included_token_uuids = [];
  const excluded_token_uuids = [];
  const excluded_protocol_ids = [];
  return {
    included_token_uuids,
    excluded_token_uuids,
    excluded_protocol_ids,
    excluded_chain_ids: [],
  };
};
