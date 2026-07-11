import type { GasLevel } from '@rabby-wallet/rabby-api/dist/types';

let currentGasLevel: GasLevel['level'] = 'normal';

export const miscServiceApi = {
  setCurrentGasLevel(level?: GasLevel['level']) {
    currentGasLevel = level || 'normal';
  },
  getCurrentGasLevel() {
    return currentGasLevel;
  },
};
