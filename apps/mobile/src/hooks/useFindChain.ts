import { findChain } from '@/utils/chain';
import { useMemo } from 'react';
import { useChainList } from './useChainList';

export const useFindChain = ({
  id,
  serverId,
  enum: chainEnum,
  hex,
  networkId,
}: Parameters<typeof findChain>[0]) => {
  const { mainnetList, testnetList } = useChainList();
  return useMemo(
    () =>
      findChain({ id, serverId, enum: chainEnum, hex, networkId }, [
        ...mainnetList,
        ...testnetList,
      ]),
    [chainEnum, hex, id, mainnetList, networkId, serverId, testnetList],
  );
};
