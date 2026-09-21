import type { DappInfo } from '@/core/services/dappService';

export const createDappBySession = ({
  origin,
  name,
  icon,
}: {
  origin: string;
  name: string;
  icon: string;
}): DappInfo => {
  const id = origin.replace(/^https?:\/\//, '');
  return {
    origin,
    chainId: undefined as any,
    name: '',
    info: {
      id,
      name: name || '',
      logo_url: icon || '',
      description: '',
      user_range: '',
      tags: [],
      chain_ids: [],
    },
  };
};
