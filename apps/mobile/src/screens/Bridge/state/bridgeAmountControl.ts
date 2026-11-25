import { makeMutable } from 'react-native-reanimated';

/**
 * Bridge scene control channel between the amount store and GestureSlider.
 * Module-level for the same reason as the Swap scene: shared values are
 * UI-thread objects and stay out of zustand.
 */
export const bridgeAmountControl = makeMutable(0);
