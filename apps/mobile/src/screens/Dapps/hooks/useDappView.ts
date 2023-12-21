import { DappInfo } from '@rabby-wallet/service-dapp';
import { atom, useAtom } from 'jotai';

const activeDappAtom = atom<DappInfo | null>(null);

export function useActiveDappView() {
  const [activeDapp, setActiveDapp] = useAtom(activeDappAtom);

  return {
    activeDapp,
    setActiveDapp,
  };
}
