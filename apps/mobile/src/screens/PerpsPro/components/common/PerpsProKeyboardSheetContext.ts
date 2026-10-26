import { createContext } from 'react';

/** Identifies the local scroll owner; never contains business or form state. */
export const PerpsProKeyboardSheetContext = createContext<string | undefined>(
  undefined,
);
