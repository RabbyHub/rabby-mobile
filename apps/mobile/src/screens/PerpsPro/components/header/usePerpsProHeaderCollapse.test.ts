import {
  getNextPerpsProHeaderScrollState,
  PERPS_PRO_HEADER_SCROLL_THRESHOLD,
  type PerpsProHeaderScrollState,
} from './usePerpsProHeaderCollapse';

const initialState = (): PerpsProHeaderScrollState => ({
  accumulatedDelta: 0,
  lastOffset: 0,
  visible: true,
});

describe('Perps Pro collapsible header', () => {
  it('hides only after cumulative upward content movement reaches threshold', () => {
    const beforeThreshold = getNextPerpsProHeaderScrollState(
      initialState(),
      PERPS_PRO_HEADER_SCROLL_THRESHOLD - 1,
    );
    expect(beforeThreshold.visible).toBe(true);

    expect(
      getNextPerpsProHeaderScrollState(
        beforeThreshold,
        PERPS_PRO_HEADER_SCROLL_THRESHOLD,
      ).visible,
    ).toBe(false);
  });

  it('restores after cumulative downward content movement reaches threshold', () => {
    const hidden: PerpsProHeaderScrollState = {
      accumulatedDelta: 0,
      lastOffset: 80,
      visible: false,
    };
    const beforeThreshold = getNextPerpsProHeaderScrollState(hidden, 69);
    expect(beforeThreshold.visible).toBe(false);
    expect(getNextPerpsProHeaderScrollState(beforeThreshold, 68).visible).toBe(
      true,
    );
  });

  it('resets directional accumulation when scroll direction changes', () => {
    const movingUp = getNextPerpsProHeaderScrollState(initialState(), 8);
    const changedDirection = getNextPerpsProHeaderScrollState(movingUp, 7);
    expect(changedDirection).toMatchObject({
      accumulatedDelta: -1,
      visible: true,
    });
  });

  it('always restores at the top and ignores invalid offsets', () => {
    const hidden: PerpsProHeaderScrollState = {
      accumulatedDelta: 5,
      lastOffset: 40,
      visible: false,
    };
    expect(getNextPerpsProHeaderScrollState(hidden, 0)).toEqual(initialState());
    expect(getNextPerpsProHeaderScrollState(hidden, Number.NaN)).toBe(hidden);
  });
});
