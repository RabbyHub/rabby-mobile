import type { SelectedBridgeQuote } from '../types';
import {
  getBridgeAllowanceRequestKey,
  getOrCreateBridgeAllowanceRequest,
  mergeBridgeQuoteBatch,
} from './quoteResultBatch';

const quote = (
  aggregatorId: string,
  bridgeId: string,
  amount: string,
): SelectedBridgeQuote =>
  ({
    aggregator: { id: aggregatorId },
    bridge: { id: bridgeId },
    to_token_amount: amount,
  } as SelectedBridgeQuote);

describe('mergeBridgeQuoteBatch', () => {
  it('matches sequential upserts while committing a batch once', () => {
    const current = [
      quote('aggregator-a', 'bridge-a', '1'),
      quote('aggregator-b', 'bridge-b', '2'),
      quote('aggregator-c', 'bridge-c', '3'),
    ];
    const result = mergeBridgeQuoteBatch(current, [
      quote('aggregator-a', 'bridge-a', '4'),
      quote('aggregator-b', 'bridge-b', '5'),
    ]);

    expect(
      result.map(item => `${item.aggregator.id}:${item.bridge.id}`),
    ).toEqual([
      'aggregator-c:bridge-c',
      'aggregator-a:bridge-a',
      'aggregator-b:bridge-b',
    ]);
    expect(result.map(item => item.to_token_amount)).toEqual(['3', '4', '5']);
    expect(current.map(item => item.to_token_amount)).toEqual(['1', '2', '3']);
  });

  it('keeps the latest duplicate update', () => {
    const result = mergeBridgeQuoteBatch(
      [quote('aggregator-a', 'bridge-a', '1')],
      [
        quote('aggregator-b', 'bridge-b', '2'),
        quote('aggregator-b', 'bridge-b', '3'),
      ],
    );

    expect(result.map(item => item.to_token_amount)).toEqual(['1', '3']);
  });

  it('preserves the current reference when there are no updates', () => {
    const current = [quote('aggregator-a', 'bridge-a', '1')];
    expect(mergeBridgeQuoteBatch(current, [])).toBe(current);
  });
});

describe('getBridgeAllowanceRequestKey', () => {
  it('normalizes address-like values for request deduplication', () => {
    expect(
      getBridgeAllowanceRequestKey({
        chainId: 'ETH',
        tokenId: '0xToken',
        spender: '0xSpender',
        account: '0xAccount',
      }),
    ).toBe('eth:0xtoken:0xspender:0xaccount');
  });
});

describe('getOrCreateBridgeAllowanceRequest', () => {
  it('shares one in-flight request for the same allowance key', async () => {
    const requests = new Map<string, Promise<string>>();
    const createRequest = jest.fn(async () => '42');

    const first = getOrCreateBridgeAllowanceRequest(
      requests,
      'shared-key',
      createRequest,
    );
    const second = getOrCreateBridgeAllowanceRequest(
      requests,
      'shared-key',
      createRequest,
    );

    expect(first).toBe(second);
    await expect(Promise.all([first, second])).resolves.toEqual(['42', '42']);
    expect(createRequest).toHaveBeenCalledTimes(1);
  });
});
