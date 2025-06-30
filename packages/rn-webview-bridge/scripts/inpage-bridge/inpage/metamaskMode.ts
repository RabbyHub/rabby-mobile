import { announceProvider } from '@rabby-wallet/universal-providers/dist/EIP6963';

import { METAMASK_PROVIDER_INFO } from './constant';

export const setupMetamaskMode = () => {
  delete (window as any).ethereum.isRabby;

  announceProvider({
    info: METAMASK_PROVIDER_INFO,
    provider: (window as any).ethereum,
  });
};
