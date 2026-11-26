import {
  getHomeFloorTravel,
  shouldHoldFirstFloorAtEnd,
} from './useHomeDrawerAnimate';

describe('getHomeFloorTravel', () => {
  const screenHeight = 852;

  it('is a full screen outside the feature-card edit mode', () => {
    expect(getHomeFloorTravel(screenHeight, 0)).toBe(screenHeight);
    expect(getHomeFloorTravel(screenHeight, -1)).toBe(screenHeight);
  });

  it('is the edit-mode distance while the cards are edited', () => {
    expect(getHomeFloorTravel(screenHeight, 548)).toBe(548);
  });

  it('never exceeds a full screen', () => {
    expect(getHomeFloorTravel(screenHeight, screenHeight + 200)).toBe(
      screenHeight,
    );
  });

  it('keeps a minimum distance when the hint sits high on the screen', () => {
    const travel = getHomeFloorTravel(screenHeight, 40);

    expect(travel).toBeGreaterThan(40);
    expect(travel).toBeCloseTo(screenHeight * 0.35);
  });

  it('passes an unmeasured screen through', () => {
    expect(getHomeFloorTravel(0, 548)).toBe(0);
  });
});

describe('shouldHoldFirstFloorAtEnd', () => {
  const screenHeight = 852;
  const editingTravel = 548;

  it('holds while the drawer rests fully open', () => {
    expect(shouldHoldFirstFloorAtEnd(-screenHeight, screenHeight, 0)).toBe(
      true,
    );
    expect(
      shouldHoldFirstFloorAtEnd(-screenHeight, screenHeight, editingTravel),
    ).toBe(true);
  });

  it('leaves the list alone on the way down outside edit mode', () => {
    // The list is scrolled back to its top there.
    expect(shouldHoldFirstFloorAtEnd(-400, screenHeight, 0)).toBe(false);
    expect(shouldHoldFirstFloorAtEnd(-1, screenHeight, 0)).toBe(false);
  });

  it('holds for as long as the drawer is on screen in edit mode', () => {
    expect(shouldHoldFirstFloorAtEnd(-400, screenHeight, editingTravel)).toBe(
      true,
    );
    expect(shouldHoldFirstFloorAtEnd(-1, screenHeight, editingTravel)).toBe(
      true,
    );
  });

  it('never holds once the drawer is closed', () => {
    expect(shouldHoldFirstFloorAtEnd(0, screenHeight, 0)).toBe(false);
    expect(shouldHoldFirstFloorAtEnd(0, screenHeight, editingTravel)).toBe(
      false,
    );
  });

  it('does not hold before the screen is measured', () => {
    expect(shouldHoldFirstFloorAtEnd(0, 0, editingTravel)).toBe(false);
  });
});
