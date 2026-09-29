import { Keyboard, Platform } from 'react-native';
import { perpsProKeyboardSession } from './perpsProKeyboardSession';

export const dismissPerpsProKeyboard = () => {
  const current = perpsProKeyboardSession.getSnapshot();
  if (current) {
    current.input.blur();
    perpsProKeyboardSession.blur(current.id);
  }
  if (Platform.OS === 'android') {
    perpsProKeyboardSession.setAndroidKeyboardVisible(false);
  }
  Keyboard.dismiss();
};
