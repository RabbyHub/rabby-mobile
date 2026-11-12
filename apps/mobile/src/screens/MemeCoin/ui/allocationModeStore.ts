import { zustandByMMKV } from '@/core/storage/mmkv';
import type { AllocationMode } from '../engine/types';

export const allocationModeStore = zustandByMMKV<{ mode: AllocationMode }>(
  '@MemeCoinAllocationMode',
  { mode: 'marketCap' },
);

export const useAllocationMode = () => allocationModeStore(state => state.mode);

export const toggleAllocationMode = () =>
  allocationModeStore.setState(state => ({
    mode: state.mode === 'marketCap' ? 'equal' : 'marketCap',
  }));
