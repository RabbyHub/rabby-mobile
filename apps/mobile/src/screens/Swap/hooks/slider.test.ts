import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { shouldReplayPendingSlider } from './pendingSlider';

const tokenA = { id: '0xaaa', chain: 'eth' } as TokenItem;
const tokenB = { id: '0xbbb', chain: 'eth' } as TokenItem;

describe('shouldReplayPendingSlider', () => {
  it('replays a deferred gesture on the token it was made on', () => {
    expect(
      shouldReplayPendingSlider(
        { value: 100, tokenId: '0xaaa', chainId: 'eth' },
        tokenA,
      ),
    ).toBe(true);
  });

  it('drops the gesture after switching to another token (new amount stays empty)', () => {
    expect(
      shouldReplayPendingSlider(
        { value: 100, tokenId: '0xaaa', chainId: 'eth' },
        tokenB,
      ),
    ).toBe(false);
  });

  it('drops the gesture when the same token id moved to another chain', () => {
    expect(
      shouldReplayPendingSlider(
        { value: 100, tokenId: '0xaaa', chainId: 'eth' },
        { id: '0xaaa', chain: 'bsc' } as TokenItem,
      ),
    ).toBe(false);
  });

  it('replays a gesture captured before any token was loaded on the first hydrated token', () => {
    expect(shouldReplayPendingSlider({ value: 50 }, tokenB)).toBe(true);
  });

  it('never replays without a token', () => {
    expect(
      shouldReplayPendingSlider({ value: 50, tokenId: '0xaaa' }, null),
    ).toBe(false);
  });
});
