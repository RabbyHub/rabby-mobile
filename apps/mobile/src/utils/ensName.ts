/**
 * ENS names, including DNS names imported into ENS, have at least two labels
 * (`vitalik.eth`, `rabby.io`). Anything else cannot resolve, so it is not worth
 * an RPC lookup.
 */
export const isPossibleEnsName = (input: string) =>
  /^[^\s.]+(\.[^\s.]+)+$/.test(input.trim());
