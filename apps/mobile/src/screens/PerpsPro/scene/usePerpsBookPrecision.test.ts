import { act, renderHook } from '@testing-library/react-native';

import type { PerpsTickOption } from '../model/orderBook';
import {
  getPerpsProSessionBookPrecision,
  resetPerpsProMarketSessionForTests,
} from '../session/perpsProMarketSession';
import { usePerpsBookPrecision } from './usePerpsBookPrecision';

const tickOptions: PerpsTickOption[] = [
  {
    displayPrice: 0.1,
    mantissa: null,
    nSigFigs: 5,
    priceDecimals: 1,
  },
  {
    displayPrice: 0.2,
    mantissa: 2,
    nSigFigs: 5,
    priceDecimals: 1,
  },
  {
    displayPrice: 1,
    mantissa: null,
    nSigFigs: 4,
    priceDecimals: 0,
  },
];

describe('usePerpsBookPrecision', () => {
  beforeEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  afterEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  it('remembers the selected precision independently for each market during the process session', () => {
    const hook = renderHook(
      ({ marketKey }: { marketKey: string }) =>
        usePerpsBookPrecision({
          marketKey,
          tickOptions,
        }),
      { initialProps: { marketKey: 'hyperliquid::BTC' } },
    );

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[0]);

    act(() => {
      hook.result.current.selectTickOption(tickOptions[1]!);
    });
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[1]);

    hook.rerender({ marketKey: 'hyperliquid::ETH' });
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[0]);

    act(() => {
      hook.result.current.selectTickOption(tickOptions[2]!);
    });
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);

    hook.rerender({ marketKey: 'hyperliquid::BTC' });
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[1]);

    hook.unmount();
    const restored = renderHook(() =>
      usePerpsBookPrecision({
        marketKey: 'hyperliquid::ETH',
        tickOptions,
      }),
    );

    expect(restored.result.current.selectedTickOption).toBe(tickOptions[2]);
  });

  it('falls back to the first legal tick without overwriting an unavailable preference', () => {
    const hook = renderHook(
      ({ options }: { options: PerpsTickOption[] }) =>
        usePerpsBookPrecision({
          marketKey: 'hyperliquid::BTC',
          tickOptions: options,
        }),
      { initialProps: { options: tickOptions } },
    );

    act(() => {
      hook.result.current.selectTickOption(tickOptions[1]!);
    });
    hook.rerender({ options: [tickOptions[2]!] });

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);
    expect(getPerpsProSessionBookPrecision('hyperliquid::BTC')).toEqual({
      mantissa: 2,
      nSigFigs: 5,
    });

    hook.rerender({ options: tickOptions });
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[1]);
  });

  it('uses the finest legal tick again after a new process session starts', () => {
    const firstSession = renderHook(() =>
      usePerpsBookPrecision({
        marketKey: 'hyperliquid::BTC',
        tickOptions,
      }),
    );

    act(() => {
      firstSession.result.current.selectTickOption(tickOptions[2]!);
    });
    firstSession.unmount();
    resetPerpsProMarketSessionForTests();

    const nextSession = renderHook(() =>
      usePerpsBookPrecision({
        marketKey: 'hyperliquid::BTC',
        tickOptions,
      }),
    );

    expect(nextSession.result.current.selectedTickOption).toBe(tickOptions[0]);
  });

  it('ignores a precision that is not legal for the current market', () => {
    const unavailableOption: PerpsTickOption = {
      displayPrice: 0.5,
      mantissa: 5,
      nSigFigs: 5,
      priceDecimals: 1,
    };
    const hook = renderHook(() =>
      usePerpsBookPrecision({
        marketKey: 'hyperliquid::BTC',
        tickOptions,
      }),
    );

    act(() => {
      hook.result.current.selectTickOption(unavailableOption);
    });

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[0]);
    expect(getPerpsProSessionBookPrecision('hyperliquid::BTC')).toBeNull();
  });
});
