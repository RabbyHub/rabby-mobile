import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';

/** Open the spot markets list from the Perps header. */
export const openPerpsSpotMarkets = () => {
  naviPush(RootNames.StackTransaction, { screen: RootNames.PerpsSpot });
};
