import { chaintable } from '@/core/chaintable';
import type { MemeUserPnlResult } from '@/core/chaintable/types';
import { refreshMemePnl, useMemePnlStore } from './memePnlStore';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/chaintable', () => ({
  chaintable: { getMemeUserPnl: jest.fn() },
}));

const fetchPnl = chaintable.getMemeUserPnl as jest.Mock;

const result = (total: number): MemeUserPnlResult => ({
  owner: '0xabc',
  total_pnl_24h_usd_value: total,
  total_cost_usd_value: 0,
  total_pnl_all_usd_value: total,
  positions: [],
  curve_24h: [],
  curve_all: [],
});

const total24h = (key: string) =>
  useMemePnlStore.getState().byAddress[key]?.periods['24h'].totalUsd;

beforeEach(() => {
  fetchPnl.mockReset();
  useMemePnlStore.setState({ byAddress: {} });
});

describe('refreshMemePnl', () => {
  it('stores the P&L under the lowercase address', async () => {
    fetchPnl.mockResolvedValue(result(5));
    await refreshMemePnl('0xABC');
    expect(fetchPnl).toHaveBeenCalledWith('0xabc');
    expect(total24h('0xabc')).toBe(5);
  });

  it('shares one request while it is in flight', async () => {
    fetchPnl.mockResolvedValue(result(5));
    await Promise.all([refreshMemePnl('0xabc'), refreshMemePnl('0xABC')]);
    expect(fetchPnl).toHaveBeenCalledTimes(1);
  });

  it('keeps the last P&L when a refresh fails, and can refresh again', async () => {
    fetchPnl.mockResolvedValueOnce(result(5));
    await refreshMemePnl('0xabc');

    fetchPnl.mockRejectedValueOnce(new Error('network'));
    await refreshMemePnl('0xabc');
    expect(total24h('0xabc')).toBe(5);

    fetchPnl.mockResolvedValueOnce(result(7));
    await refreshMemePnl('0xabc');
    expect(total24h('0xabc')).toBe(7);
  });
});
