import { makeMutable } from 'react-native-reanimated';

/**
 * Scene-scoped control channel between the amount store and GestureSlider.
 *
 * Deliberately module-level: shared values are UI-thread objects and must not
 * live inside the zustand store. Swap and Bridge get independent instances
 * once Bridge is migrated.
 */
export const swapAmountControl = makeMutable(0);
