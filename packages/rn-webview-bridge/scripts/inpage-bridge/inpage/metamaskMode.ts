import { announceProvider } from '@rabby-wallet/universal-providers/dist/EIP6963';

import { METAMASK_PROVIDER_INFO } from './constant';

let isDone = false;
export const setupMetamaskMode = (options?: { isKeepRabby?: boolean }) => {
  if (!('isRabby' in (window as any).rabby) || isDone) {
    return;
  }

  if (!options?.isKeepRabby) {
    delete (window as any).rabby.isRabby;
    delete (window as any).ethereum.isRabby;
  }

  isDone = true;

  announceProvider({
    info: METAMASK_PROVIDER_INFO,
    provider: (window as any).rabby,
  });
};
