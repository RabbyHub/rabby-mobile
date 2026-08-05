import {
  buildHome24hProjection,
  buildHomeBalanceProjection,
  createInitialHomeAccountProjection,
  reduceHomeAccountProjection,
  type HomeProjectionResourceFlow,
} from './model';

const ADDRESS_A = '0xaaa';
const ADDRESS_B = '0xbbb';
const ADDRESS_C = '0xccc';

function resolveAccounts(
  addresses: string[],
  previous = createInitialHomeAccountProjection(),
) {
  return reduceHomeAccountProjection(previous, {
    selectedAddresses: addresses,
    hasResolvedSelection: true,
    matteredAccountLength: addresses.length,
    hasResolvedMatteredAccountLength: true,
    isFetchingAccounts: false,
  });
}

function makeBalance(totalBalance: number, evmBalance = totalBalance) {
  return { totalBalance, evmBalance };
}

function makeFlow(
  value: Partial<HomeProjectionResourceFlow>,
): HomeProjectionResourceFlow {
  return value;
}

describe('home portfolio projection model', () => {
  it('keeps unresolved, empty, and ready account selection distinct', () => {
    const initial = createInitialHomeAccountProjection();
    const unresolved = reduceHomeAccountProjection(initial, {
      selectedAddresses: [],
      hasResolvedSelection: false,
      matteredAccountLength: 0,
      hasResolvedMatteredAccountLength: false,
      isFetchingAccounts: true,
    });
    const empty = resolveAccounts([], unresolved);
    const ready = resolveAccounts([ADDRESS_A], empty);

    expect(unresolved).toMatchObject({
      availability: 'unresolved',
      selectionGeneration: 0,
      activity: { isFetchingRemote: true },
    });
    expect(empty).toMatchObject({
      availability: 'empty',
      selectionGeneration: 0,
    });
    expect(ready).toMatchObject({
      availability: 'ready',
      addresses: [ADDRESS_A],
      selectionGeneration: 1,
    });
  });

  it('treats a cached unresolved selection as partial and usable', () => {
    const account = reduceHomeAccountProjection(
      createInitialHomeAccountProjection(),
      {
        selectedAddresses: [ADDRESS_A],
        hasResolvedSelection: false,
        matteredAccountLength: 1,
        hasResolvedMatteredAccountLength: false,
        isFetchingAccounts: true,
      },
    );
    const balance = buildHomeBalanceProjection({
      account,
      valueMap: { [ADDRESS_A]: makeBalance(10) },
    });

    expect(account.availability).toBe('partial');
    expect(balance).toMatchObject({
      availability: 'partial',
      value: { totalBalance: 10 },
    });
  });

  it('publishes partial balance while a promoted address is still missing', () => {
    const account = resolveAccounts([ADDRESS_A, ADDRESS_C]);
    const projection = buildHomeBalanceProjection({
      account,
      valueMap: {
        [ADDRESS_A]: makeBalance(10),
        [ADDRESS_B]: makeBalance(50),
      },
      flowMap: {
        [ADDRESS_C]: makeFlow({ isFetchingRemote: true }),
      },
    });

    expect(projection).toMatchObject({
      availability: 'partial',
      sourceAddresses: [ADDRESS_A],
      missingAddresses: [ADDRESS_C],
      value: { totalBalance: 10 },
      activity: {
        isFetchingRemote: true,
        isActive: true,
        activeAddresses: [ADDRESS_C],
      },
    });
  });

  it('derives 24h change from the current selection during delete and promotion', () => {
    let account = resolveAccounts([ADDRESS_A, ADDRESS_B]);
    const currentBalanceMap = {
      [ADDRESS_A]: makeBalance(120, 120),
      [ADDRESS_B]: makeBalance(80, 80),
    };
    const previousBalanceMap = {
      [ADDRESS_A]: { total_usd_value: 100 },
      [ADDRESS_B]: { total_usd_value: 100 },
    };
    const beforeDelete = buildHome24hProjection({
      account,
      currentBalanceMap,
      previousBalanceMap,
    });

    account = resolveAccounts([ADDRESS_A, ADDRESS_C], account);
    const afterDelete = buildHome24hProjection({
      account,
      currentBalanceMap,
      previousBalanceMap,
      previousFlowMap: {
        [ADDRESS_C]: makeFlow({ isFetchingRemote: true }),
      },
    });

    expect(beforeDelete).toMatchObject({
      availability: 'ready',
      sourceAddresses: [ADDRESS_A, ADDRESS_B],
      value: {
        rawChange: 0,
        changePercent: '0.00%',
      },
    });
    expect(afterDelete).toMatchObject({
      availability: 'partial',
      sourceAddresses: [ADDRESS_A],
      missingAddresses: [ADDRESS_C],
      value: {
        rawChange: 20,
        changePercent: '20.00%',
      },
    });
    expect(afterDelete.selectionGeneration).toBeGreaterThan(
      beforeDelete.selectionGeneration,
    );
  });

  it('ignores a deleted address even when its late resource result arrives', () => {
    const account = resolveAccounts([ADDRESS_A, ADDRESS_C]);
    const beforeLateResult = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS_A]: makeBalance(120),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
      },
    });
    const afterDeletedAddressReturns = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS_A]: makeBalance(120),
        [ADDRESS_B]: makeBalance(999),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_B]: { total_usd_value: 1 },
      },
    });

    expect(afterDeletedAddressReturns).toEqual(beforeLateResult);
  });

  it('converges from partial to ready when the promoted address arrives', () => {
    const account = resolveAccounts([ADDRESS_A, ADDRESS_C]);
    const partial = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS_A]: makeBalance(120),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
      },
    });
    const ready = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS_A]: makeBalance(120),
        [ADDRESS_C]: makeBalance(55, 55),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_C]: { total_usd_value: 50 },
      },
    });

    expect(partial.availability).toBe('partial');
    expect(ready).toMatchObject({
      availability: 'ready',
      sourceAddresses: [ADDRESS_A, ADDRESS_C],
      missingAddresses: [],
      value: {
        rawChange: 25,
        changePercent: '16.67%',
      },
    });
  });

  it('keeps a real zero change displayable', () => {
    const account = resolveAccounts([ADDRESS_A]);
    const projection = buildHome24hProjection({
      account,
      currentBalanceMap: { [ADDRESS_A]: makeBalance(0) },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 0 },
      },
    });

    expect(projection).toMatchObject({
      availability: 'ready',
      value: {
        rawChange: 0,
        changePercent: '0%',
        isLoss: false,
      },
    });
  });

  it('shows loading only when no comparable value exists', () => {
    const account = resolveAccounts([ADDRESS_A]);
    const projection = buildHome24hProjection({
      account,
      currentBalanceMap: {},
      previousBalanceMap: {},
      currentFlowMap: {
        [ADDRESS_A]: makeFlow({ isHydrating: true }),
      },
    });

    expect(projection).toMatchObject({
      availability: 'loading',
      value: undefined,
      sourceAddresses: [],
      missingAddresses: [ADDRESS_A],
      activity: {
        isHydrating: true,
        isActive: true,
      },
    });
  });

  it('keeps availability separate from refresh activity', () => {
    const account = resolveAccounts([ADDRESS_A]);
    const projection = buildHome24hProjection({
      account,
      currentBalanceMap: { [ADDRESS_A]: makeBalance(120) },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
      },
      previousFlowMap: {
        [ADDRESS_A]: makeFlow({ isFetchingRemote: true }),
      },
    });

    expect(projection).toMatchObject({
      availability: 'ready',
      value: { changePercent: '20.00%' },
      activity: {
        isFetchingRemote: true,
        isActive: true,
      },
    });
  });

  it('aggregates activity from current and historical resources', () => {
    const account = resolveAccounts([ADDRESS_A]);
    const projection = buildHome24hProjection({
      account,
      currentBalanceMap: { [ADDRESS_A]: makeBalance(120) },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
      },
      currentFlowMap: {
        [ADDRESS_A]: makeFlow({ isHydrating: true }),
      },
      previousFlowMap: {
        [ADDRESS_A]: makeFlow({ isFetchingRemote: true }),
      },
      isComputing: true,
    });

    expect(projection.activity).toEqual({
      isHydrating: true,
      isFetchingRemote: true,
      isComputing: true,
      isActive: true,
      activeAddresses: [ADDRESS_A],
    });
  });
});
