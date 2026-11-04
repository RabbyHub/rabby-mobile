import {
  createPerpsMarketDetailHeaderSource,
  subscribePerpsMarketDetailHeader,
} from './marketDetailHeaderPresentation';

const cleanups: Array<() => void> = [];
const activate = (routeKey = 'detail', market = 'BTC') => {
  const source = createPerpsMarketDetailHeaderSource(routeKey, market);
  cleanups.push(source.activate());
  return source;
};
const observe = (routeKey = 'detail', market = 'BTC') => {
  const listener = jest.fn();
  cleanups.push(subscribePerpsMarketDetailHeader(routeKey, market, listener));
  return listener;
};
const compact = (
  source: ReturnType<typeof createPerpsMarketDetailHeaderSource>,
  price = '$100',
) => {
  source.presentation.quote({ price }, true);
  source.presentation.layout(80);
  source.presentation.scroll(80);
};

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach(cleanup => cleanup());
});

describe('market detail declarative header channel', () => {
  it('supports header-first mounting without publishing normal-header price ticks or redundant scrolls', () => {
    const listener = observe();
    const source = activate();
    expect(listener).toHaveBeenCalledTimes(1);
    source.presentation.quote({ price: '$100' }, true);
    source.presentation.quote({ price: '$101' }, true);
    source.presentation.layout(80);
    source.presentation.scroll(79);
    expect(listener).toHaveBeenCalledTimes(1);
    source.presentation.scroll(80);
    expect(listener.mock.lastCall?.[0]).toEqual({
      compact: true,
      quote: { price: '$101' },
    });
    source.presentation.scroll(81);
    source.presentation.quote({ price: '$101' }, true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('catches up a later header and suppresses inactive publication until reactivation', () => {
    const source = activate();
    compact(source);
    const listener = observe();
    expect(listener.mock.lastCall?.[0]).toEqual({
      compact: true,
      quote: { price: '$100' },
    });
    source.presentation.quote({ price: '$200' }, false);
    expect(listener).toHaveBeenCalledTimes(1);
    source.presentation.quote({ price: '$200' }, true);
    expect(listener.mock.lastCall?.[0].quote.price).toBe('$200');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('isolates repeated market routes and different markets within a route', () => {
    const first = observe('first', 'BTC');
    const second = observe('second', 'BTC');
    const nextMarket = observe('first', 'ETH');
    compact(activate('first', 'BTC'));
    expect(first.mock.lastCall?.[0].compact).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(nextMarket).toHaveBeenCalledTimes(1);
    compact(activate('second', 'BTC'), '$300');
    expect(second.mock.lastCall?.[0].quote.price).toBe('$300');
    expect(first.mock.lastCall?.[0].quote.price).toBe('$100');
  });

  it('prevents an obsolete screen publisher or cleanup from replacing the newer source', () => {
    const old = activate();
    const oldRelease = cleanups[cleanups.length - 1];
    compact(old);
    const current = activate();
    compact(current, '$300');
    const listener = observe();
    old.presentation.quote({ price: '$999' }, true);
    oldRelease();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.lastCall?.[0].quote.price).toBe('$300');
  });

  it('supports StrictMode cleanup/reactivation without allowing the previous cleanup to clear current state', () => {
    const source = createPerpsMarketDetailHeaderSource('detail', 'BTC');
    const firstRelease = source.activate();
    compact(source);
    firstRelease();
    cleanups.push(source.activate());
    const listener = observe();
    firstRelease();
    source.presentation.quote({ price: '$200' }, true);
    expect(listener.mock.lastCall?.[0]).toEqual({
      compact: true,
      quote: { price: '$200' },
    });
  });

  it('clears disposed route state and ignores late quotes after unmount', () => {
    const source = activate();
    const release = cleanups[cleanups.length - 1];
    compact(source);
    const listener = observe();
    release();
    expect(listener.mock.lastCall?.[0].compact).toBe(false);
    const count = listener.mock.calls.length;
    source.presentation.quote({ price: '$999' }, true);
    expect(listener).toHaveBeenCalledTimes(count);
    const later = observe();
    expect(later.mock.lastCall?.[0].compact).toBe(false);
  });
});
