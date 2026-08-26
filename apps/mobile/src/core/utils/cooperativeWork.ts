export type CooperativeWorkClock = {
  now: () => number;
  yieldToHost: () => Promise<void>;
};

export type MapWithJsBudgetOptions = {
  budgetMs?: number;
  minimumItemsPerSlice?: number;
  shouldContinue?: () => boolean;
  onYield?: (sliceDurationMs: number) => void;
  clock?: CooperativeWorkClock;
};

type ForEachWithJsBudgetOptions = MapWithJsBudgetOptions;

const defaultClock: CooperativeWorkClock = {
  now: () => global.performance?.now?.() ?? Date.now(),
  yieldToHost: () => new Promise(resolve => setTimeout(resolve, 0)),
};

export async function forEachWithJsBudget<TInput>(
  input: readonly TInput[],
  visitItem: (item: TInput, index: number) => void,
  options: ForEachWithJsBudgetOptions = {},
): Promise<boolean> {
  const budgetMs = options.budgetMs ?? 6;
  const minimumItemsPerSlice = options.minimumItemsPerSlice ?? 32;
  const clock = options.clock ?? defaultClock;
  let sliceStartedAt = clock.now();

  for (let index = 0; index < input.length; index += 1) {
    if (options.shouldContinue && !options.shouldContinue()) {
      return false;
    }

    visitItem(input[index]!, index);
    const completedInSlice = (index + 1) % minimumItemsPerSlice;
    if (completedInSlice !== 0 || index === input.length - 1) {
      continue;
    }
    const sliceDurationMs = clock.now() - sliceStartedAt;
    if (sliceDurationMs < budgetMs) {
      continue;
    }

    options.onYield?.(sliceDurationMs);
    await clock.yieldToHost();
    if (options.shouldContinue && !options.shouldContinue()) {
      return false;
    }
    sliceStartedAt = clock.now();
  }

  return true;
}

/**
 * Maps CPU-bound data in bounded JS slices. A null result means the caller's
 * request became stale before the complete snapshot was prepared.
 */
export async function mapWithJsBudget<TInput, TOutput>(
  input: readonly TInput[],
  mapItem: (item: TInput, index: number) => TOutput,
  options: MapWithJsBudgetOptions = {},
): Promise<TOutput[] | null> {
  const budgetMs = options.budgetMs ?? 6;
  const minimumItemsPerSlice = options.minimumItemsPerSlice ?? 32;
  const clock = options.clock ?? defaultClock;
  const output = new Array<TOutput>(input.length);
  let sliceStartedAt = clock.now();

  for (let index = 0; index < input.length; index += 1) {
    if (options.shouldContinue && !options.shouldContinue()) {
      return null;
    }

    output[index] = mapItem(input[index]!, index);
    const completedInSlice = (index + 1) % minimumItemsPerSlice;
    if (completedInSlice !== 0 || index === input.length - 1) {
      continue;
    }
    const sliceDurationMs = clock.now() - sliceStartedAt;
    if (sliceDurationMs < budgetMs) {
      continue;
    }

    options.onYield?.(sliceDurationMs);
    await clock.yieldToHost();
    if (options.shouldContinue && !options.shouldContinue()) {
      return null;
    }
    sliceStartedAt = clock.now();
  }

  return output;
}
