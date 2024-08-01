import { getCHAIN_ID_LIST } from '@/constant/chains';

export { getCHAIN_ID_LIST };

export const getChainName = (chain?: string) => {
  return (chain && getCHAIN_ID_LIST().get(chain)?.name) || 'Unsupported chain';
};
