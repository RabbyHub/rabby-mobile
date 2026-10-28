import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { ONE_HOUR_MS } from '../constants';
import { resolveBridgeArrival } from './bridgeArrival';

const history = (txId: string, status: BridgeHistory['status']) =>
  ({ from_tx: { tx_id: txId }, status } as unknown as BridgeHistory);

describe('resolveBridgeArrival', () => {
  const now = 10 * ONE_HOUR_MS;

  it('stays pending while the tx is not indexed yet', () => {
    expect(
      resolveBridgeArrival([], { hash: '0x1', createdAt: now - 1000, now }),
    ).toEqual({ type: 'pending' });
  });

  it('times out when the tx is still not found after one hour', () => {
    expect(
      resolveBridgeArrival([history('0x2', 'completed')], {
        hash: '0x1',
        createdAt: now - ONE_HOUR_MS - 1,
        now,
      }),
    ).toEqual({ type: 'notFoundTimeout' });
  });

  it('stays pending while the found tx is still pending', () => {
    expect(
      resolveBridgeArrival([history('0x1', 'pending')], {
        hash: '0x1',
        createdAt: 0,
        now,
      }),
    ).toEqual({ type: 'pending' });
  });

  it('settles completed and failed txs', () => {
    const done = history('0x1', 'completed');
    expect(
      resolveBridgeArrival([done], { hash: '0x1', createdAt: 0, now }),
    ).toEqual({ type: 'settled', status: 'allSuccess', bridgeTx: done });
    const failed = history('0x1', 'failed');
    expect(
      resolveBridgeArrival([failed], { hash: '0x1', createdAt: 0, now }),
    ).toEqual({ type: 'settled', status: 'failed', bridgeTx: failed });
  });
});
