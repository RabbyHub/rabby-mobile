import { patchCurveData } from './curve';

describe('patchCurveData', () => {
  it('prepends zero-filled points when the requested start is earlier than the first timestamp', () => {
    expect(
      patchCurveData(
        [
          { timestamp: 30, price: 3 },
          { timestamp: 40, price: 4 },
        ],
        10,
        10,
      ),
    ).toEqual([
      { timestamp: 10, price: 0 },
      { timestamp: 20, price: 0 },
      { timestamp: 30, price: 3 },
      { timestamp: 40, price: 4 },
    ]);
  });

  it('returns the original data when the start is not earlier than the first timestamp', () => {
    const data = [{ timestamp: 30, price: 3 }];

    expect(patchCurveData(data, 30, 10)).toBe(data);
    expect(patchCurveData(data, 40, 10)).toBe(data);
  });
});
