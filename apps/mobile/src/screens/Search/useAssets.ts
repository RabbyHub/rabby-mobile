import {
  combinedTokensAtom,
  combinedDefiAtom,
  combinedNFTAtom,
} from '@/screens/Home/hooks/store';
import { useAtom } from 'jotai';

export const useQueryProjects = () => {
  const [tokens] = useAtom(combinedTokensAtom);

  const [portfolios] = useAtom(combinedDefiAtom);
  const [nftList] = useAtom(combinedNFTAtom);

  return {
    tokens,
    portfolios,
    nftList,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
