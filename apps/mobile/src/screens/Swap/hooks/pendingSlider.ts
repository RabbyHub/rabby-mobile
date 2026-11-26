import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export type PendingSliderGesture = {
  value: number;
  /** Token the gesture was made on; empty when the token was not loaded yet. */
  tokenId?: string;
  chainId?: string;
};

/**
 * A deferred slider gesture may only be replayed on the token it was made on.
 * A gesture captured while no token was loaded is allowed to replay on the
 * first token that hydrates (that is the case this deferral exists for).
 */
export function shouldReplayPendingSlider(
  pending: PendingSliderGesture | null,
  token?: Pick<TokenItem, 'id' | 'chain'> | null,
) {
  if (!pending || !token) {
    return false;
  }
  if (!pending.tokenId) {
    return true;
  }
  return pending.tokenId === token.id && pending.chainId === token.chain;
}
