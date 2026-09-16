import type { TextInputProps } from 'react-native';
import { PERPS_PRO_DIALOG_TOKENS } from './perpsProDialogVisual';

// iOS uses selectionColor for the native caret, selection and handles.
// Keep all Pro input hosts on the same existing mint as the primary action.
export const PERPS_PRO_INPUT_COLOR_PROPS = {
  cursorColor: PERPS_PRO_DIALOG_TOKENS.inputCursor,
  selectionColor: PERPS_PRO_DIALOG_TOKENS.inputCursor,
} as const satisfies Pick<TextInputProps, 'cursorColor' | 'selectionColor'>;
