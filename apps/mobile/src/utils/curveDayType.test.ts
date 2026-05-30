import { CurveDayType } from './curveDayType';

describe('CurveDayType', () => {
  it('maps chart day types to the day counts used by balance curves', () => {
    expect(CurveDayType.DAY).toBe(1);
    expect(CurveDayType.WEEK).toBe(7);
  });
});
