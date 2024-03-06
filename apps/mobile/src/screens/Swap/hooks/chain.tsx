import { swapService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { useState } from 'react';

export const useSwapChain = () => {
  const [chain, setChain] = useState(
    swapService.getSelectedChain() || CHAINS_ENUM.ETH,
  );

  const onChainChange = (chain: CHAINS_ENUM) => {
    swapService.setSelectedChain(chain);
    setChain(chain);
  };
  return [chain, onChainChange] as const;
};
