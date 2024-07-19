import { getChainList } from '@/constant/chains';
import { atom, useAtom } from 'jotai';

export const chainListAtom = atom({
  mainnetList: getChainList('mainnet'),
  testnetList: getChainList('testnet'),
});

export const useChainList = () => {
  const [chainList] = useAtom(chainListAtom);

  return {
    ...chainList,
  };
};
