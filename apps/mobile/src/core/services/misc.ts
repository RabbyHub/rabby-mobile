import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';

class MiscService {
  currentGasLevel: GasLevel['level'] = 'normal';

  setCurrentGasLevel = (level?: GasLevel['level']) => {
    this.currentGasLevel = level || 'normal';
  };

  getCurrentGasLevel = () => this.currentGasLevel;
}

const miscService = new MiscService();

export default miscService;
