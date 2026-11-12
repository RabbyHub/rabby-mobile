import { renderHook } from '@testing-library/react-native';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { usePerpsGroupedMarketData } from './usePerpsGroupedMarketData';

let mockLanguage = 'en';
const mockTranslate = (key: string) => `${mockLanguage}:${key}`;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('@/hooks/lang', () => ({
  useAppLanguage: () => ({ currentLanguage: mockLanguage }),
}));

describe('usePerpsGroupedMarketData derivation boundaries', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('updates backend category membership and translations without sorting unchanged markets', () => {
    const readVolume = jest.fn(() => '10');
    const token = {
      name: 'XYZ',
      categoryId: 'stock',
      get dayNtlVlm() {
        return readVolume();
      },
    } as MarketData;
    const props: Parameters<typeof usePerpsGroupedMarketData>[0] = {
      marketData: [token],
      favoriteMarkets: [],
      backendCategories: [],
    };
    const { result, rerender } = renderHook(usePerpsGroupedMarketData, {
      initialProps: props,
    });
    readVolume.mockClear();
    rerender({
      ...props,
      backendCategories: [
        { id: 'stock', name: 'Stocks', translations: { en: 'Stocks latest' } },
      ],
    });
    const category = result.current.visibleSearchTabs.find(
      tab => tab.id === 'stock',
    );
    expect(category?.cfg.label).toBe('Stocks latest');
    expect(category?.items[0]).toBe(token);
    rerender(props);
    expect(result.current.fullByCategory.stock).toBeUndefined();
    expect(result.current.visibleSearchTabs.map(tab => tab.id)).toEqual([
      'topVolume',
    ]);
    expect(readVolume).not.toHaveBeenCalled();
  });

  it('reuses volume order for favorites and language changes, but sorts fresh markets', () => {
    const readVolume = jest.fn((volume: string) => volume);
    const market = (name: string, volume: string) =>
      ({
        name,
        get dayNtlVlm() {
          return readVolume(volume);
        },
      } as MarketData);
    const btc = market('BTC', '10');
    const eth = market('ETH', '20');
    const sol = market('SOL', '20');
    const props: Parameters<typeof usePerpsGroupedMarketData>[0] = {
      marketData: [btc, eth, sol],
      favoriteMarkets: [],
      backendCategories: [],
    };
    const { result, rerender } = renderHook(usePerpsGroupedMarketData, {
      initialProps: props,
    });
    expect(result.current.fullByCategory.topVolume).toEqual([eth, sol, btc]);
    expect(readVolume).toHaveBeenCalledTimes(3);
    readVolume.mockClear();

    const favoriteProps = { ...props, favoriteMarkets: ['btc'] };
    rerender(favoriteProps);
    expect(result.current.fullByCategory.favorite).toEqual([btc]);
    expect(readVolume).not.toHaveBeenCalled();

    mockLanguage = 'zh';
    rerender(favoriteProps);
    expect(result.current.visibleHome[0].cfg.label).toBe(
      'zh:page.perps.categories.favorite',
    );
    expect(readVolume).not.toHaveBeenCalled();

    const updatedBtc = market('BTC', '30');
    rerender({ ...favoriteProps, marketData: [updatedBtc, eth, sol] });
    expect(result.current.fullByCategory.topVolume).toEqual([
      updatedBtc,
      eth,
      sol,
    ]);
    expect(result.current.fullByCategory.favorite).toEqual([updatedBtc]);
    expect(readVolume).toHaveBeenCalledTimes(3);
  });
});
