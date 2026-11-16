import type {
  BridgeHistory,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { ONE_HOUR_MS } from '../constants';
import { resolveBridgeArrival } from './bridgeArrival';

const NOW = 10 * ONE_HOUR_MS;
const HASH = '0xabc123';

const token = (chain: string, id: string) =>
  ({ id, chain, symbol: id, decimals: 18, price: 1, amount: 0 } as TokenItem);
const USDC_BASE = token('base', '0xusdc');
const USDC_BSC = token('bsc', '0xusdc');

const local = (
  over: Partial<BridgeTxHistoryItem> = {},
): BridgeTxHistoryItem => ({
  address: '0xuser',
  fromChainId: 8453,
  toChainId: 56,
  fromToken: USDC_BASE,
  toToken: USDC_BSC,
  slippage: 0.01,
  fromAmount: 10,
  toAmount: 9.9,
  dexId: 'lifi',
  status: 'pending',
  hash: HASH,
  estimatedDuration: 60,
  createdAt: NOW - 1000,
  ...over,
});

const remote = ({
  status = 'pending',
  txId = HASH,
  chain = 'base',
  fromTxStatus = 'success',
}: {
  status?: BridgeHistory['status'];
  txId?: string;
  chain?: string;
  fromTxStatus?: BridgeHistory['from_tx']['status'];
} = {}) =>
  ({
    from_token: { ...USDC_BASE, chain },
    to_token: USDC_BSC,
    to_actual_token: USDC_BSC,
    quote: { pay_token_amount: 10, receive_token_amount: 9.9 },
    actual: { pay_token_amount: 10, receive_token_amount: 9.9 },
    status,
    create_at: (NOW - 1000) / 1000,
    from_tx: { tx_id: txId, chain_id: chain, status: fromTxStatus },
    to_tx: { tx_id: status === 'completed' ? '0xdest' : undefined },
  } as BridgeHistory);

describe('resolveBridgeArrival', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps waiting while the tx is not indexed yet', () => {
    expect(resolveBridgeArrival([], local())).toEqual({ type: 'pending' });
  });

  it('gives up once an unmatched tx is more than an hour old', () => {
    expect(
      resolveBridgeArrival(
        [remote({ txId: '0xother' })],
        local({ createdAt: NOW - ONE_HOUR_MS - 1 }),
      ),
    ).toEqual({ type: 'notFoundTimeout' });
  });

  it('matches the hash case-insensitively on the source chain only', () => {
    const done = remote({ status: 'completed', txId: HASH.toUpperCase() });
    expect(resolveBridgeArrival([done], local())).toEqual({
      type: 'settled',
      status: 'allSuccess',
      bridgeTx: done,
    });
    expect(
      resolveBridgeArrival(
        [remote({ status: 'completed', chain: 'arb' })],
        local(),
      ),
    ).toEqual({ type: 'pending' });
  });

  it('prefers the sped-up hash over the original one', () => {
    const original = remote({ status: 'failed', fromTxStatus: 'failed' });
    const spedUp = remote({ status: 'completed', txId: '0xfast' });
    expect(
      resolveBridgeArrival(
        [original, spedUp],
        local({ acceleratedHash: '0xfast' }),
      ),
    ).toEqual({ type: 'settled', status: 'allSuccess', bridgeTx: spedUp });
  });

  it('keeps waiting while the bridge is still in flight', () => {
    expect(resolveBridgeArrival([remote()], local())).toEqual({
      type: 'pending',
    });
  });

  it('settles a failed source tx and a failed bridge as failures', () => {
    const sourceFailed = remote({ status: 'failed', fromTxStatus: 'failed' });
    expect(resolveBridgeArrival([sourceFailed], local())).toEqual({
      type: 'settled',
      status: 'fromFailed',
      bridgeTx: sourceFailed,
    });
    const bridgeFailed = remote({ status: 'failed' });
    expect(resolveBridgeArrival([bridgeFailed], local())).toEqual({
      type: 'settled',
      status: 'failed',
      bridgeTx: bridgeFailed,
    });
  });
});
