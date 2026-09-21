export type PerpsBookPrecision = Readonly<{
  nSigFigs: 2 | 3 | 4 | 5;
  mantissa: 2 | 5 | null;
}>;

export const PERPS_BOOK_ATOMIC_SWITCH_BUDGET_MS = 250;
