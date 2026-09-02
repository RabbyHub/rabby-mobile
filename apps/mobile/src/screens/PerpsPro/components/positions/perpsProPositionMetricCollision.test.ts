import { resolvePerpsProPositionMetricCollision } from './perpsProPositionMetricCollision';

describe('resolvePerpsProPositionMetricCollision', () => {
  const compactMeasurements = {
    middleFirstLineWidth: 72,
    middleFirstLineX: 0,
    rightNaturalWidth: 88,
    rowWidth: 345,
    secondColumnX: 136,
  };

  it('keeps compact geometry when the measured labels preserve the gutter', () => {
    expect(resolvePerpsProPositionMetricCollision(compactMeasurements, 8)).toBe(
      false,
    );
  });

  it('expands when the measured labels overlap or consume the gutter', () => {
    expect(
      resolvePerpsProPositionMetricCollision(
        { ...compactMeasurements, rightNaturalWidth: 130 },
        8,
      ),
    ).toBe(true);
    expect(
      resolvePerpsProPositionMetricCollision(
        { ...compactMeasurements, rightNaturalWidth: 129 },
        8,
      ),
    ).toBe(false);
  });

  it('expands when a bounded right label reports more than one native line', () => {
    expect(
      resolvePerpsProPositionMetricCollision({ rightWrapped: true }, 8),
    ).toBe(true);
  });

  it.each([
    {},
    { ...compactMeasurements, rowWidth: 0 },
    { ...compactMeasurements, rightNaturalWidth: Number.NaN },
    { ...compactMeasurements, middleFirstLineWidth: -1 },
    { ...compactMeasurements, secondColumnX: Number.POSITIVE_INFINITY },
  ])('waits for complete finite native measurements: %o', measurements => {
    expect(resolvePerpsProPositionMetricCollision(measurements, 8)).toBeNull();
  });
});
