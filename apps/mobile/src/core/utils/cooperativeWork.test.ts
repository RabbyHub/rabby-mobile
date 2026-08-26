import { forEachWithJsBudget, mapWithJsBudget } from './cooperativeWork';

describe('mapWithJsBudget', () => {
  it('preserves input ordering while yielding between expensive slices', async () => {
    let now = 0;
    const yieldToHost = jest.fn(async () => {
      now += 1;
    });

    const result = await mapWithJsBudget(
      [1, 2, 3, 4, 5],
      value => {
        now += 3;
        return value * 2;
      },
      {
        budgetMs: 5,
        minimumItemsPerSlice: 2,
        clock: {
          now: () => now,
          yieldToHost,
        },
      },
    );

    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(yieldToHost).toHaveBeenCalledTimes(2);
  });

  it('stops without publishing a partial result when work becomes stale', async () => {
    let active = true;
    const result = await mapWithJsBudget(
      [1, 2, 3, 4],
      value => {
        if (value === 2) {
          active = false;
        }
        return value;
      },
      {
        minimumItemsPerSlice: 1,
        shouldContinue: () => active,
      },
    );

    expect(result).toBeNull();
  });
});

describe('forEachWithJsBudget', () => {
  it('visits every item while yielding between bounded slices', async () => {
    let now = 0;
    const visited: number[] = [];
    const yieldToHost = jest.fn(async () => {
      now += 1;
    });

    await expect(
      forEachWithJsBudget(
        [1, 2, 3, 4, 5],
        item => {
          visited.push(item);
          now += 3;
        },
        {
          budgetMs: 5,
          minimumItemsPerSlice: 2,
          clock: {
            now: () => now,
            yieldToHost,
          },
        },
      ),
    ).resolves.toBe(true);

    expect(visited).toEqual([1, 2, 3, 4, 5]);
    expect(yieldToHost).toHaveBeenCalledTimes(2);
  });

  it('stops before visiting stale work', async () => {
    let current = true;
    const visited: number[] = [];

    await expect(
      forEachWithJsBudget(
        [1, 2, 3],
        item => {
          visited.push(item);
          current = false;
        },
        {
          minimumItemsPerSlice: 1,
          shouldContinue: () => current,
        },
      ),
    ).resolves.toBe(false);

    expect(visited).toEqual([1]);
  });
});
