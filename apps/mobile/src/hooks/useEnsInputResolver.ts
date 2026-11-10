import { useEffect, useRef, useState } from 'react';
import { resolveEnsAddressByName, resolveEnsNameByAddress } from '@/utils/ens';
import { isPossibleEnsName } from '@/utils/ensName';

export type EnsInputResult = {
  addr: string;
  name: string;
};

type SettledLookup = {
  query: string;
  result: EnsInputResult | null;
};

type UseEnsInputResolverOptions = {
  /**
   * Returns the address to look up a name for when `input` is an address,
   * otherwise null so that `input` is resolved as a name. Must be stable.
   */
  parseAddress: (input: string) => string | null;
  debounceMs?: number;
};

export type EnsInputResolution = {
  /** The lookup result for the current input. Never the result of an earlier input. */
  ensResult: EnsInputResult | null;
  /**
   * The current input is not an address and its name lookup has not settled
   * yet, so whether it resolves is still unknown. Covers inputs that cannot be
   * names too: they settle as not found after the debounce, without a request.
   */
  isPending: boolean;
  /** A lookup of a possible ENS name is scheduled or still running. */
  isResolvingName: boolean;
  /** The current input is not an address and did not resolve as a name. */
  isNameNotFound: boolean;
};

/**
 * Resolves an address-or-name input: a name to its address, an address to its
 * name. ENS lookups cannot be aborted (CCIP-Read names can take seconds), so a
 * late result for an earlier input is dropped instead of being shown for the
 * current one.
 */
export function useEnsInputResolver(
  input: string,
  { parseAddress, debounceMs = 500 }: UseEnsInputResolverOptions,
): EnsInputResolution {
  const [settled, setSettled] = useState<SettledLookup | null>(null);
  const latestInputRef = useRef(input);

  useEffect(() => {
    latestInputRef.current = input;
    if (!input) {
      return;
    }

    const query = input;
    const address = parseAddress(query);
    const timer = setTimeout(async () => {
      let result: EnsInputResult | null = null;
      try {
        if (address) {
          const name = await resolveEnsNameByAddress(address);
          result = name ? { addr: address, name } : null;
        } else if (isPossibleEnsName(query)) {
          const resolved = await resolveEnsAddressByName(query);
          result = resolved?.addr ? resolved : null;
        }
      } catch {
        result = null;
      }

      if (latestInputRef.current !== query) {
        return;
      }
      setSettled({ query, result });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [input, parseAddress, debounceMs]);

  const current = settled && settled.query === input ? settled : null;
  const isName = !!input && !parseAddress(input);
  const isPending = isName && !current;

  return {
    ensResult: current?.result ?? null,
    isPending,
    isResolvingName: isPending && isPossibleEnsName(input),
    isNameNotFound: isName && !!current && !current.result,
  };
}
