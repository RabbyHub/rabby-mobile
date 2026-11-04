import { zustandByMMKV } from '@/core/storage/mmkv';
import {
  allocationModeStore,
  toggleAllocationMode,
} from './allocationModeStore';

jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: jest.fn((_key: string, initialState: object) => {
    const { create } = jest.requireActual(
      'zustand',
    ) as typeof import('zustand');
    return create(() => initialState);
  }),
}));

describe('allocationModeStore', () => {
  it('keeps the mode in a persisted store, by market cap at first', () => {
    expect(zustandByMMKV).toHaveBeenCalledWith('@MemeCoinAllocationMode', {
      mode: 'marketCap',
    });
  });

  it('toggles between the two modes', () => {
    allocationModeStore.setState({ mode: 'marketCap' });
    toggleAllocationMode();
    expect(allocationModeStore.getState().mode).toBe('equal');
    toggleAllocationMode();
    expect(allocationModeStore.getState().mode).toBe('marketCap');
  });
});
