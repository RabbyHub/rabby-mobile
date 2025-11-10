import { trigger } from 'react-native-haptic-feedback';

export function touchedFeedback() {
  return trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
}
