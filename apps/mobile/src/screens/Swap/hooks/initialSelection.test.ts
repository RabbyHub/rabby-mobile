import type { CHAINS_ENUM } from '@debank/common';

import { shouldApplyInitialChainFallback } from './initialSelection';

const ETHEREUM_CHAIN = 'ETH' as CHAINS_ENUM;

describe('shouldApplyInitialChainFallback', () => {
  const baseInput = {
    persistedSelectionStatus: 'ready' as const,
    persistedSelectedChain: null,
    hasExplicitSelection: false,
    hasAppliedFallback: false,
  };

  it('uses the chain-list fallback only after persisted selection resolves empty', () => {
    expect(shouldApplyInitialChainFallback(baseInput)).toBe(true);
  });

  it.each([
    {
      name: 'persisted selection is still pending',
      input: { ...baseInput, persistedSelectionStatus: 'pending' as const },
    },
    {
      name: 'a persisted chain exists',
      input: {
        ...baseInput,
        persistedSelectedChain: ETHEREUM_CHAIN,
      },
    },
    {
      name: 'a route or user selection already exists',
      input: { ...baseInput, hasExplicitSelection: true },
    },
    {
      name: 'the fallback was already applied',
      input: { ...baseInput, hasAppliedFallback: true },
    },
  ])('does not replace selection when $name', ({ input }) => {
    expect(shouldApplyInitialChainFallback(input)).toBe(false);
  });
});
