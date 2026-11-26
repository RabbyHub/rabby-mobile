import { MultiHomeFeatTitle } from '@/constant/newStyle';
import {
  HOME_MOVABLE_FEATURES,
  HOME_PINNED_FEATURES,
  getDefaultHomeFeatureLayout,
  getHomeFeatureLeaveOffset,
  isHomeFeatureMovable,
  isSameHomeFeatureLayout,
  moveHomeFeature,
  normalizeHomeFeatureLayout,
} from './homeFeatureLayout';

const {
  GasAccount,
  History,
  Market,
  Approvals,
  Points,
  ConvertDust,
  MemeCoin,
  Swap,
  Bridge,
  Send,
  Receive,
  Perps,
  Lending,
} = MultiHomeFeatTitle;

describe('homeFeatureLayout', () => {
  it('starts with Gas deposit and Approvals on the second floor', () => {
    expect(getDefaultHomeFeatureLayout()).toEqual({
      home: [History, Market, Points, ConvertDust, MemeCoin],
      more: [GasAccount, Approvals],
    });
  });

  it('keeps the Home grid order: Lending after Perps, Memecoin last', () => {
    expect([
      ...HOME_PINNED_FEATURES,
      ...getDefaultHomeFeatureLayout().home,
    ]).toEqual([
      Swap,
      Bridge,
      Send,
      Receive,
      Perps,
      Lending,
      History,
      Market,
      Points,
      ConvertDust,
      MemeCoin,
    ]);
  });

  it('keeps pinned and movable cards apart', () => {
    for (const key of HOME_PINNED_FEATURES) {
      expect(isHomeFeatureMovable(key)).toBe(false);
    }
    for (const key of HOME_MOVABLE_FEATURES) {
      expect(isHomeFeatureMovable(key)).toBe(true);
    }
  });

  describe('moveHomeFeature', () => {
    it('drops a card first on the floor it moves to', () => {
      const layout = getDefaultHomeFeatureLayout();

      const moved = moveHomeFeature(layout, History, 'more');
      expect(moved).toEqual({
        home: [Market, Points, ConvertDust, MemeCoin],
        more: [History, GasAccount, Approvals],
      });

      expect(moveHomeFeature(moved, History, 'home')).toEqual({
        home: [History, Market, Points, ConvertDust, MemeCoin],
        more: [GasAccount, Approvals],
      });
    });

    it('can empty a floor', () => {
      let layout = getDefaultHomeFeatureLayout();
      layout = moveHomeFeature(layout, GasAccount, 'home');
      layout = moveHomeFeature(layout, Approvals, 'home');

      expect(layout.more).toEqual([]);
      expect(layout.home).toEqual([
        Approvals,
        GasAccount,
        History,
        Market,
        Points,
        ConvertDust,
        MemeCoin,
      ]);
    });

    it('returns the same layout when there is nothing to move', () => {
      const layout = getDefaultHomeFeatureLayout();

      // A pinned card never moves.
      expect(moveHomeFeature(layout, Swap, 'more')).toBe(layout);
      // Already on the target floor.
      expect(moveHomeFeature(layout, History, 'home')).toBe(layout);
      expect(moveHomeFeature(layout, GasAccount, 'more')).toBe(layout);
    });

    it('does not mutate its input', () => {
      const layout = getDefaultHomeFeatureLayout();
      const snapshot = JSON.parse(JSON.stringify(layout));

      moveHomeFeature(layout, Market, 'more');

      expect(layout).toEqual(snapshot);
    });
  });

  describe('normalizeHomeFeatureLayout', () => {
    it('keeps a valid stored layout as it is', () => {
      const stored = {
        home: [MemeCoin, History],
        more: [Market, GasAccount, Approvals, Points, ConvertDust],
      };

      expect(normalizeHomeFeatureLayout(stored)).toEqual(stored);
    });

    it('falls back to the default layout for unusable input', () => {
      const defaults = getDefaultHomeFeatureLayout();

      expect(normalizeHomeFeatureLayout(undefined)).toEqual(defaults);
      expect(normalizeHomeFeatureLayout(null)).toEqual(defaults);
      expect(normalizeHomeFeatureLayout('broken')).toEqual(defaults);
      expect(normalizeHomeFeatureLayout({ home: 'x', more: 1 })).toEqual(
        defaults,
      );
    });

    it('drops unknown, pinned and duplicated keys', () => {
      const normalized = normalizeHomeFeatureLayout({
        home: [History, 'Removed Feature', Swap, History, Market],
        more: [Market, GasAccount, Approvals, Points, ConvertDust, MemeCoin],
      });

      expect(normalized).toEqual({
        home: [History, Market],
        more: [GasAccount, Approvals, Points, ConvertDust, MemeCoin],
      });
    });

    it('puts a card the stored layout does not know on its default floor', () => {
      // As if Points, Convert Dust, Memecoin and Approvals shipped after this
      // layout was saved.
      const normalized = normalizeHomeFeatureLayout({
        home: [Market],
        more: [History, GasAccount],
      });

      expect(normalized).toEqual({
        home: [Market, Points, ConvertDust, MemeCoin],
        more: [History, GasAccount, Approvals],
      });
    });

    it('always accounts for every movable card exactly once', () => {
      const normalized = normalizeHomeFeatureLayout({ home: [MemeCoin] });
      const all = [...normalized.home, ...normalized.more];

      expect(all).toHaveLength(HOME_MOVABLE_FEATURES.length);
      expect(new Set(all)).toEqual(new Set(HOME_MOVABLE_FEATURES));
    });
  });

  it('compares layouts by order', () => {
    const layout = getDefaultHomeFeatureLayout();

    expect(isSameHomeFeatureLayout(layout, getDefaultHomeFeatureLayout())).toBe(
      true,
    );
    expect(
      isSameHomeFeatureLayout(layout, moveHomeFeature(layout, History, 'more')),
    ).toBe(false);
    expect(
      isSameHomeFeatureLayout(layout, {
        ...layout,
        home: [...layout.home].reverse(),
      }),
    ).toBe(false);
  });
});

describe('getHomeFeatureLeaveOffset', () => {
  const windowHeight = 852;
  const cardHeight = 96;

  it('sends a Home card down past the bottom edge by one card height', () => {
    // Top at 400: 452 to the bottom edge, then one more card height.
    expect(
      getHomeFeatureLeaveOffset('home', 400, windowHeight, cardHeight),
    ).toBe(452 + cardHeight);
  });

  it('sends a second-floor card up past the top edge by one card height', () => {
    // Top at 170: 266 until its bottom edge is off, then one more card height.
    expect(
      getHomeFeatureLeaveOffset('more', 170, windowHeight, cardHeight),
    ).toBe(-(266 + cardHeight));
  });

  it('still moves a card that is already past the edge', () => {
    expect(
      getHomeFeatureLeaveOffset('home', 900, windowHeight, cardHeight),
    ).toBe(cardHeight);
    expect(
      getHomeFeatureLeaveOffset('more', -200, windowHeight, cardHeight),
    ).toBe(-cardHeight);
  });

  it('crosses a whole window when the card could not be measured', () => {
    expect(
      getHomeFeatureLeaveOffset('home', null, windowHeight, cardHeight),
    ).toBe(windowHeight + cardHeight);
    expect(
      getHomeFeatureLeaveOffset('more', null, windowHeight, cardHeight),
    ).toBe(-(windowHeight + cardHeight));
  });
});
