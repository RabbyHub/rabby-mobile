import {
  getLinkedHeaderNativeInterpolation,
  getLinkedHeaderTranslateX,
} from './linkedHeaderGeometry';

describe('shared linked header viewport geometry', () => {
  it.each([1, 1.00001, 1.1, 1.3333333, 1.5, 1.99999, 2])(
    'has exactly zero displacement within the group at %s',
    progress => {
      expect(getLinkedHeaderTranslateX(progress, 1, 2, 393.333)).toBe(0);
    },
  );

  it.each([
    [0, 400],
    [0.25, 300],
    [0.75, 100],
    [1, 0],
    [2, 0],
    [2.25, -100],
    [2.75, -300],
    [3, -400],
  ])('enters/exits once with the adjacent page at %s', (progress, expected) => {
    expect(getLinkedHeaderTranslateX(progress, 1, 2, 400)).toBe(expected);
  });

  it('keeps a one-child group stationary only at its one physical page', () => {
    expect(getLinkedHeaderTranslateX(0.5, 1, 1, 400)).toBe(200);
    expect(getLinkedHeaderTranslateX(1, 1, 1, 400)).toBe(0);
    expect(getLinkedHeaderTranslateX(1.5, 1, 1, 400)).toBe(-200);
  });

  it('handles a wider group without accumulating compensating transforms', () => {
    for (let step = 0; step <= 100; step++) {
      expect(getLinkedHeaderTranslateX(4 + step / 50, 4, 6, 412)).toBe(0);
    }
    expect(getLinkedHeaderTranslateX(3.5, 4, 6, 412)).toBe(206);
    expect(getLinkedHeaderTranslateX(6.5, 4, 6, 412)).toBe(-206);
  });
});

describe('native header interpolation configuration', () => {
  it('maps one native offset clock to enter, hold and leave', () => {
    expect(getLinkedHeaderNativeInterpolation(1, 2, 400)).toEqual({
      inputRange: [0, 400, 800, 1200],
      outputRange: [400, 0, 0, -400],
      extrapolate: 'extend',
    });
  });

  it('supports a one-child group without duplicate input values', () => {
    expect(getLinkedHeaderNativeInterpolation(1, 1, 400)).toEqual({
      inputRange: [0, 400, 800],
      outputRange: [400, 0, -400],
      extrapolate: 'extend',
    });
  });

  it('keeps the same zero plateau for a wider group at the first root', () => {
    expect(getLinkedHeaderNativeInterpolation(0, 3, 320)).toEqual({
      inputRange: [-320, 0, 960, 1280],
      outputRange: [320, 0, 0, -320],
      extrapolate: 'extend',
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not build a native graph before a valid width (%s)',
    width => {
      expect(getLinkedHeaderNativeInterpolation(1, 2, width)).toBeNull();
    },
  );
});
