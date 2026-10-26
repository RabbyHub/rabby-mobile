import {
  getPerpsProHeaderGeometry,
  getNextPerpsProHeaderScrollState,
  PERPS_PRO_HEADER_SCROLL_THRESHOLD,
  type PerpsProHeaderScrollState,
} from './usePerpsProHeaderCollapse';
import { PERPS_HEADER_HEIGHT } from '../../../PerpsShared/constants';
import { PERPS_PRO_HEADER_HEIGHT } from './constants';

const initialState = (): PerpsProHeaderScrollState => ({
  accumulatedDelta: 0,
  lastOffset: 0,
  visible: true,
});

describe('Perps Pro collapsible header', () => {
  it('derives the collapse geometry from the shared mode header height', () => {
    expect(PERPS_PRO_HEADER_HEIGHT).toBe(PERPS_HEADER_HEIGHT);
  });

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

  it('stays hidden during upward content movement until the list reaches the top', () => {
    const hidden: PerpsProHeaderScrollState = {
      accumulatedDelta: 0,
      lastOffset: 80,
      visible: false,
    };
    const beforeThreshold = getNextPerpsProHeaderScrollState(hidden, 69);
    expect(beforeThreshold.visible).toBe(false);
    expect(getNextPerpsProHeaderScrollState(beforeThreshold, 68).visible).toBe(
      false,
    );
    expect(getNextPerpsProHeaderScrollState(beforeThreshold, 0).visible).toBe(
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

  it('keeps the header bottom and market top adjacent without moving the scroll owner', () => {
    for (const [offset, visibilityProgress] of [
      [0, 0],
      [10, 0],
      [30, 0.5],
      [PERPS_PRO_HEADER_HEIGHT, 0],
      [200, 1],
    ]) {
      const geometry = getPerpsProHeaderGeometry(offset, visibilityProgress);
      expect(geometry.headerTranslateY + PERPS_PRO_HEADER_HEIGHT).toBeCloseTo(
        geometry.marketTranslateY,
      );
      expect(geometry.headerOpacity).toBeGreaterThanOrEqual(0);
      expect(geometry.headerOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('naturally collapses while hidden and restores both overlays without changing offset', () => {
    expect(getPerpsProHeaderGeometry(20, 0)).toEqual({
      headerOpacity: 1 - 20 / PERPS_PRO_HEADER_HEIGHT,
      headerTranslateY: -20,
      marketTranslateY: PERPS_PRO_HEADER_HEIGHT - 20,
    });
    expect(getPerpsProHeaderGeometry(200, 0)).toEqual({
      headerOpacity: 0,
      headerTranslateY: -PERPS_PRO_HEADER_HEIGHT,
      marketTranslateY: 0,
    });
    expect(getPerpsProHeaderGeometry(200, 1)).toEqual({
      headerOpacity: 1,
      headerTranslateY: 0,
      marketTranslateY: PERPS_PRO_HEADER_HEIGHT,
    });
  });

  it('does not reveal again during a slow monotonic gesture before the top', () => {
    let state = initialState();
    for (const offset of [2, 4, 6, 8, 10, 12, 14, 16]) {
      state = getNextPerpsProHeaderScrollState(state, offset);
    }
    expect(state.visible).toBe(false);

    for (const offset of [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]) {
      state = getNextPerpsProHeaderScrollState(state, offset);
    }
    expect(state.visible).toBe(false);
    state = getNextPerpsProHeaderScrollState(state, 0);
    expect(state.visible).toBe(true);
  });
});
