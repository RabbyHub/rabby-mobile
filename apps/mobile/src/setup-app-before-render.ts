import { runIIFEFunc } from './core/utils/store';
import { startSyncDefaultRPCs } from './hooks/defaultRPCs';
import { startSubscribeBalanceUpdated } from './hooks/useCurve';
import { storeApiGasAccount } from './screens/GasAccount/hooks/atom';

startSubscribeBalanceUpdated();
startSyncDefaultRPCs();
runIIFEFunc(() => {
  storeApiGasAccount.fetchGasAccountInfo();
});
