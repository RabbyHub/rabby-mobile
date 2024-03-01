import { CHAIN_ID_LIST } from '@/constant/chains';

export { CHAIN_ID_LIST };

export const getChainName = (chain?: string) => {
  return (chain && CHAIN_ID_LIST.get(chain)?.name) || 'Unsupported chain';
};
