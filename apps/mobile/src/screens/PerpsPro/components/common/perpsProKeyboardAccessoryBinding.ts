import { Platform } from 'react-native';
import { PERPS_PRO_KEYBOARD_ACCESSORY_ID } from './perpsProKeyboardSession';

// Select the actual renderer, not the build channel or the branch default.
export const usesPerpsProInputAccessory = () =>
  Platform.OS === 'ios' &&
  (globalThis as typeof globalThis & { nativeFabricUIManager?: unknown })
    .nativeFabricUIManager != null;

export const getPerpsProKeyboardAccessoryID = (inputId: string) =>
  Platform.OS !== 'ios'
    ? undefined
    : usesPerpsProInputAccessory()
    ? `${PERPS_PRO_KEYBOARD_ACCESSORY_ID}-${inputId}`
    : PERPS_PRO_KEYBOARD_ACCESSORY_ID;
