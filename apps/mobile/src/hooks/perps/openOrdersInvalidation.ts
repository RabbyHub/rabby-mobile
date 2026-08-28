export type PerpsOpenOrdersInvalidationCoordinator = ReturnType<
  typeof createPerpsOpenOrdersInvalidationCoordinator
>;

export const createPerpsOpenOrdersInvalidationCoordinator = ({
  fetchDex,
  flush,
  isCurrentAddress,
}: {
  fetchDex: (
    dex: string,
    address: string,
    generation: number,
  ) => Promise<boolean>;
  flush: (address: string) => void;
  isCurrentAddress: (address: string) => boolean;
}) => {
  type Session = {
    active: Promise<void> | null;
    address: string;
    generation: number;
    pendingDexes: Set<string>;
  };

  let generation = 0;
  let session: Session | null = null;

  const drain = (target: Session) => {
    if (target.active) {
      return;
    }
    const run = async () => {
      while (
        session === target &&
        target.generation === generation &&
        target.pendingDexes.size > 0
      ) {
        const dexes = Array.from(target.pendingDexes);
        target.pendingDexes.clear();
        const results = await Promise.all(
          dexes.map(dex => fetchDex(dex, target.address, target.generation)),
        );
        if (session !== target || target.generation !== generation) {
          return;
        }
        if (results.some(Boolean)) {
          flush(target.address);
        }
      }
    };
    target.active = run().finally(() => {
      if (session !== target) {
        return;
      }
      target.active = null;
      if (target.pendingDexes.size > 0) {
        drain(target);
      }
    });
  };

  return {
    getGeneration: () => generation,
    invalidate: (address: string, dexes: Iterable<string>) => {
      if (!isCurrentAddress(address)) {
        return;
      }
      if (
        !session ||
        session.generation !== generation ||
        session.address.toLowerCase() !== address.toLowerCase()
      ) {
        session = {
          active: null,
          address,
          generation,
          pendingDexes: new Set<string>(),
        };
      }
      for (const dex of dexes) {
        session.pendingDexes.add(dex);
      }
      if (session.pendingDexes.size === 0) {
        session.pendingDexes.add('');
      }
      drain(session);
    },
    reset: () => {
      generation += 1;
      session = null;
    },
  };
};
