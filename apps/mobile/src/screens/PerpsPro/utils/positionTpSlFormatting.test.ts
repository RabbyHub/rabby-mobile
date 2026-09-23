import {
  formatPositionTpSlMagnitude,
  formatPositionTpSlSignedValue,
} from './positionTpSlFormatting';

describe('position TP/SL decimal presentation', () => {
  it.each([
    ['0.00994', '0.01', '+0.01'],
    ['-0.00994', '0.01', '-0.01'],
    ['1.005', '1.01', '+1.01'],
    ['-1.005', '1.01', '-1.01'],
    ['1234.995', '1235', '+1,235.00'],
    ['0', '0', '0.00'],
    ['0.004', '0', '+0.00'],
    ['-0.004', '0', '-0.00'],
    [null, '', '-'],
    ['NaN', '', '-'],
  ])(
    'rounds %s consistently without changing input/display sign conventions',
    (value, input, display) => {
      expect(formatPositionTpSlMagnitude(value)).toBe(input);
      expect(formatPositionTpSlSignedValue(value)).toBe(display);
    },
  );
});
