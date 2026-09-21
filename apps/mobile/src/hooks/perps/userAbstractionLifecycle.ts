export interface PerpsUserAbstractionAccountIdentity {
  address: string;
  type: string;
}

export interface PerpsUserAbstractionRuntimeContext<
  TAccount extends PerpsUserAbstractionAccountIdentity,
> {
  account: TAccount | null;
  generation: number;
}

export interface PerpsUserAbstractionRequest<
  TAccount extends PerpsUserAbstractionAccountIdentity,
> {
  account: TAccount;
  generation: number;
  sequence: number;
}

interface PerpsUserAbstractionLifecycleDependencies<
  TAccount extends PerpsUserAbstractionAccountIdentity,
  TValue,
> {
  getRuntimeContext: () => PerpsUserAbstractionRuntimeContext<TAccount>;
  isSameAccount: (left: TAccount | null, right: TAccount | null) => boolean;
  onLoading: (request: PerpsUserAbstractionRequest<TAccount>) => void;
  onResolved: (
    request: PerpsUserAbstractionRequest<TAccount>,
    value: TValue,
  ) => void;
  query: (address: string) => Promise<TValue>;
}

/**
 * Owns only request ordering. The resolved abstraction remains in the shared
 * Perps Store supplied by the caller; this controller is not another state
 * source.
 */
export const createPerpsUserAbstractionLifecycle = <
  TAccount extends PerpsUserAbstractionAccountIdentity,
  TValue,
>(
  dependencies: PerpsUserAbstractionLifecycleDependencies<TAccount, TValue>,
) => {
  let requestSequence = 0;
  let latestRequestSequence = 0;

  const isRequestCurrent = (request: PerpsUserAbstractionRequest<TAccount>) => {
    const runtime = dependencies.getRuntimeContext();
    return (
      request.sequence === latestRequestSequence &&
      request.generation === runtime.generation &&
      dependencies.isSameAccount(runtime.account, request.account)
    );
  };

  const refresh = async (account: TAccount): Promise<TValue | null> => {
    if (!account.address.trim()) {
      throw new Error('Perps abstraction address is required');
    }

    const runtime = dependencies.getRuntimeContext();
    if (!dependencies.isSameAccount(runtime.account, account)) {
      return null;
    }

    const request: PerpsUserAbstractionRequest<TAccount> = {
      account,
      generation: runtime.generation,
      sequence: ++requestSequence,
    };
    latestRequestSequence = request.sequence;
    dependencies.onLoading(request);

    const value = await dependencies.query(account.address);
    if (!isRequestCurrent(request)) {
      return null;
    }

    dependencies.onResolved(request, value);
    return value;
  };

  return { refresh };
};
