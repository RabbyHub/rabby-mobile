import {
  buildPortfolioAddressChange,
  buildPortfolioAggregateChange,
  resolvePortfolioAddressBalance,
} from './consistency';
import {
  buildHome24hProjection,
  buildHomeBalanceProjection,
  createInitialHomeAccountProjection,
  reduceHomeAccountProjection,
} from './model';

const ADDRESS_A = '0xaaa';
const ADDRESS_B = '0xbbb';
const ADDRESS_OUTSIDE_HOME = '0xccc';

function selectHomeAddresses(addresses: string[]) {
  return reduceHomeAccountProjection(createInitialHomeAccountProjection(), {
    selectedAddresses: addresses,
    hasResolvedSelection: true,
    matteredAccountLength: addresses.length,
    hasResolvedMatteredAccountLength: true,
    hasFetchedAccounts: true,
    isFetchingAccounts: false,
  });
}

describe('portfolio consumer consistency', () => {
  it('keeps the balance card and Home Header on the same aggregate projection', () => {
    const account = selectHomeAddresses([ADDRESS_A, ADDRESS_B]);
    const balance = buildHomeBalanceProjection({
      account,
      valueMap: {
        [ADDRESS_A]: { totalBalance: 130, evmBalance: 120 },
        [ADDRESS_B]: { totalBalance: 75, evmBalance: 70 },
      },
    });
    const change = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS_A]: { totalBalance: 130, evmBalance: 120 },
        [ADDRESS_B]: { totalBalance: 75, evmBalance: 70 },
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_B]: { total_usd_value: 80 },
      },
    });

    const balanceCard = {
      totalBalance: balance.value?.totalBalance,
      change: change.value,
    };
    const homeHeader = {
      totalBalance: balance.value?.totalBalance,
      change: change.value,
    };

    expect(balanceCard).toEqual(homeHeader);
  });

  it('aggregates only comparable addresses selected by Home', () => {
    const account = selectHomeAddresses([ADDRESS_A, ADDRESS_B]);
    const currentBalanceMap = {
      [ADDRESS_A]: { totalBalance: 130, evmBalance: 120 },
      [ADDRESS_B]: { totalBalance: 75, evmBalance: 70 },
      [ADDRESS_OUTSIDE_HOME]: { totalBalance: 999, evmBalance: 999 },
    };
    const previousBalanceMap = {
      [ADDRESS_A]: { total_usd_value: 100 },
      [ADDRESS_B]: { total_usd_value: 80 },
      [ADDRESS_OUTSIDE_HOME]: { total_usd_value: 1 },
    };
    const projection = buildHome24hProjection({
      account,
      currentBalanceMap,
      previousBalanceMap,
    });
    const expected = buildPortfolioAggregateChange(
      account.addresses.map(address =>
        buildPortfolioAddressChange({
          currentEvmBalance: currentBalanceMap[address]?.evmBalance,
          previousEvmBalance: previousBalanceMap[address]?.total_usd_value,
        }),
      ),
    );

    expect(projection.sourceAddresses).toEqual([ADDRESS_A, ADDRESS_B]);
    expect(projection.value).toEqual(expected);
  });

  it('keeps account-list and single-address values equal when 24h data exists', () => {
    const current = { totalBalance: 130, evmBalance: 120 };
    const previousEvmBalance = 100;
    const accountListChange = buildPortfolioAddressChange({
      currentEvmBalance: current.evmBalance,
      previousEvmBalance,
    });
    const singleAddressChange = buildPortfolioAddressChange({
      currentEvmBalance: current.evmBalance,
      previousEvmBalance,
      curveStartEvmBalance: 90,
      allowCurveFallback: true,
    });

    expect(singleAddressChange).toEqual(accountListChange);
    expect(singleAddressChange?.source).toBe('balance24h');
  });

  it('allows a curve-only single-address change when account-list 24h data is absent', () => {
    const accountListChange = buildPortfolioAddressChange({
      currentEvmBalance: 120,
    });
    const singleAddressChange = buildPortfolioAddressChange({
      currentEvmBalance: 120,
      curveStartEvmBalance: 90,
      allowCurveFallback: true,
    });

    expect(accountListChange).toBeUndefined();
    expect(singleAddressChange).toMatchObject({
      source: 'curve',
      rawChange: 30,
      changePercent: '33.33%',
    });
  });

  it('does not replace a real resource zero with a stale account snapshot', () => {
    expect(
      resolvePortfolioAddressBalance({
        resource: { totalBalance: 0, evmBalance: 0 },
        fallback: { totalBalance: 42, evmBalance: 40 },
      }),
    ).toEqual({
      totalBalance: 0,
      evmBalance: 0,
      source: 'resource',
    });
  });
});
