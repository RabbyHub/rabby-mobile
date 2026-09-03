import { shouldDisablePreparedUpsert } from './preparedUpsertPolicy';

describe('prepared upsert policy', () => {
  it('keeps prepared upsert enabled when online config is unavailable', () => {
    expect(
      shouldDisablePreparedUpsert({
        isDev: false,
        isNonPublicProductionEnv: false,
        onlineDisablePreparedUpsert: undefined,
      }),
    ).toBe(false);
  });

  it('allows public production to explicitly disable prepared upsert', () => {
    expect(
      shouldDisablePreparedUpsert({
        isDev: false,
        isNonPublicProductionEnv: false,
        onlineDisablePreparedUpsert: true,
      }),
    ).toBe(true);
  });

  it.each([
    { isDev: true, isNonPublicProductionEnv: false },
    { isDev: false, isNonPublicProductionEnv: true },
  ])(
    'does not disable the tested prepared path in $isDev/$isNonPublicProductionEnv',
    options => {
      expect(
        shouldDisablePreparedUpsert({
          ...options,
          onlineDisablePreparedUpsert: true,
        }),
      ).toBe(false);
    },
  );
});
