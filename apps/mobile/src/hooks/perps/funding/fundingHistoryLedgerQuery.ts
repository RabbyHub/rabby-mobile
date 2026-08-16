export const createPerpsFundingLedgerQuery = <Scope, LedgerItem>({
  applyLedger,
  fetchLedger,
  getScope,
  getScopeKey,
  onError,
}: {
  applyLedger: (items: readonly LedgerItem[], scope: Scope) => void;
  fetchLedger: (scope: Scope) => Promise<readonly LedgerItem[]>;
  getScope: () => Scope | null;
  getScopeKey: (scope: Scope) => string;
  onError?: (error: unknown) => void;
}) => {
  const flights = new Map<string, Promise<boolean>>();

  return (): Promise<boolean> => {
    const expectedScope = getScope();
    if (!expectedScope) {
      return Promise.resolve(false);
    }
    const requestKey = getScopeKey(expectedScope);
    const existingFlight = flights.get(requestKey);
    if (existingFlight) {
      return existingFlight;
    }

    const flight = (async () => {
      try {
        const items = await fetchLedger(expectedScope);
        const activeScope = getScope();
        if (
          !activeScope ||
          getScopeKey(activeScope) !== getScopeKey(expectedScope)
        ) {
          return false;
        }
        applyLedger(items, expectedScope);
        return true;
      } catch (error) {
        onError?.(error);
        return false;
      }
    })();
    flights.set(requestKey, flight);
    flight.finally(() => {
      if (flights.get(requestKey) === flight) {
        flights.delete(requestKey);
      }
    });
    return flight;
  };
};
