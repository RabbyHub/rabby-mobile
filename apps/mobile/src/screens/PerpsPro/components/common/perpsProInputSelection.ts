import { Platform, type TextInputProps } from 'react-native';

const ANDROID_EMPTY_INPUT_SELECTION = { end: 0, start: 0 } as const;

export const resolvePerpsProEmptyInputSelection = (
  platform: typeof Platform.OS = Platform.OS,
): TextInputProps['selection'] =>
  platform === 'android' ? ANDROID_EMPTY_INPUT_SELECTION : undefined;
