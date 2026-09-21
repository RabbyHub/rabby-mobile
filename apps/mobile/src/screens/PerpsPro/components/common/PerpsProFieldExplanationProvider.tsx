import React, { useCallback, useMemo, useState } from 'react';

import type { PerpsProFieldExplanationKey } from '../../model/fieldExplanation';
import {
  PerpsProFieldExplanationContext,
  type OpenPerpsProFieldExplanation,
} from './PerpsProFieldExplanationContext';
import { PerpsProFieldExplanationSheet } from './PerpsProFieldExplanationSheet';
import { usePerpsProDismissKeyboard } from './usePerpsProDismissKeyboard';

export const PerpsProFieldExplanationProvider: React.FC<
  React.PropsWithChildren
> = ({ children }) => {
  const [activeKey, setActiveKey] =
    useState<PerpsProFieldExplanationKey | null>(null);
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  const open = useCallback<OpenPerpsProFieldExplanation>(
    explanationKey => {
      dismissKeyboardThen(() => setActiveKey(explanationKey));
    },
    [dismissKeyboardThen],
  );
  const contextValue = useMemo(() => open, [open]);

  return (
    <PerpsProFieldExplanationContext.Provider value={contextValue}>
      {children}
      {activeKey ? (
        <PerpsProFieldExplanationSheet
          explanationKey={activeKey}
          onDismiss={() => setActiveKey(null)}
        />
      ) : null}
    </PerpsProFieldExplanationContext.Provider>
  );
};
