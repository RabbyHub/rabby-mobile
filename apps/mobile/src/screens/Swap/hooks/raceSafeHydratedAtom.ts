import { atom, getDefaultStore } from 'jotai';

type RaceSafeHydratedAtomOptions<Value, Update> = {
  initialValue: Value;
  hydrate: () => Promise<Value>;
  commitUpdate: (previous: Value, update: Update) => Promise<Value>;
  optimisticUpdate?: (previous: Value, update: Update) => Value;
  onHydrationError?: (error: unknown) => void;
};

export function createRaceSafeHydratedAtom<Value, Update>({
  initialValue,
  hydrate,
  commitUpdate,
  optimisticUpdate,
  onHydrationError = console.error,
}: RaceSafeHydratedAtomOptions<Value, Update>) {
  let revision = 0;
  const valueAtom = atom(initialValue);

  valueAtom.onMount = setValue => {
    const hydrationRevision = revision;
    void hydrate()
      .then(value => {
        if (hydrationRevision === revision) {
          setValue(value);
        }
      })
      .catch(onHydrationError);
  };

  const hydratedAtom = atom(
    get => get(valueAtom),
    async (get, set, update: Update) => {
      const previous = get(valueAtom);
      const updateRevision = ++revision;
      if (optimisticUpdate) {
        set(valueAtom, optimisticUpdate(previous, update));
      }

      try {
        const committedValue = await commitUpdate(previous, update);
        if (updateRevision === revision) {
          set(valueAtom, committedValue);
        }
      } catch (error) {
        if (updateRevision === revision) {
          if (optimisticUpdate) {
            set(valueAtom, previous);
          } else {
            void hydrate()
              .then(value => {
                if (updateRevision === revision) {
                  set(valueAtom, value);
                }
              })
              .catch(onHydrationError);
          }
        }
        throw error;
      }
    },
  );

  return Object.assign(hydratedAtom, {
    prepare(value: Value) {
      ++revision;
      getDefaultStore().set(valueAtom, value);
    },
  });
}
