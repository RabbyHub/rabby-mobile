type TokenLoadTask = () => Promise<void>;

export function createTokenLoadCoordinator() {
  const inFlightRequests = new Map<string, Promise<void>>();
  let lastInitialRequestKey: string | null = null;

  const load = (requestKey: string, task: TokenLoadTask) => {
    const inFlightRequest = inFlightRequests.get(requestKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = task().finally(() => {
      if (inFlightRequests.get(requestKey) === request) {
        inFlightRequests.delete(requestKey);
      }
    });
    inFlightRequests.set(requestKey, request);
    return request;
  };

  const ensureInitial = (requestKey: string, task: TokenLoadTask) => {
    if (lastInitialRequestKey === requestKey) {
      return inFlightRequests.get(requestKey);
    }

    lastInitialRequestKey = requestKey;
    const request = load(requestKey, task);
    request.catch(() => {
      if (lastInitialRequestKey === requestKey) {
        lastInitialRequestKey = null;
      }
    });
    return request;
  };

  return {
    load,
    ensureInitial,
  };
}
