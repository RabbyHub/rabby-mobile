import { triggerImpact } from '@/utils/common';

export const triggerPerpsProLightHaptic = () => {
  triggerImpact({
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
  });
};
