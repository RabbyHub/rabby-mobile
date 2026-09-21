import { createContext, useContext } from 'react';

import type { PerpsProFieldExplanationKey } from '../../model/fieldExplanation';

export type OpenPerpsProFieldExplanation = (
  explanationKey: PerpsProFieldExplanationKey,
) => void;

export const PerpsProFieldExplanationContext =
  createContext<OpenPerpsProFieldExplanation>(() => undefined);

export const usePerpsProFieldExplanation = () =>
  useContext(PerpsProFieldExplanationContext);
