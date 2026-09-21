import {
  EIP7702RevokeMiniGasLimit,
  getEIP7702MiniGasLimit,
  removeLeadingZeroes,
} from './7702';

describe('utils/7702', () => {
  describe('removeLeadingZeroes', () => {
    it('returns undefined as-is', () => {
      expect(removeLeadingZeroes(undefined)).toBeUndefined();
    });

    it('converts 0x0 into bare 0x', () => {
      expect(removeLeadingZeroes('0x0')).toBe('0x');
    });

    it('removes repeated leading zero bytes only', () => {
      expect(removeLeadingZeroes('0x0000002a')).toBe('0x2a');
    });

    it('keeps already-trimmed hex values unchanged', () => {
      expect(removeLeadingZeroes('0x2a')).toBe('0x2a');
    });
  });

  describe('getEIP7702MiniGasLimit', () => {
    it('returns the minimum gas limit when the input is smaller', () => {
      expect(getEIP7702MiniGasLimit(1)).toBe(
        `0x${EIP7702RevokeMiniGasLimit.toString(16)}`,
      );
    });

    it('returns the input gas limit when it already meets the minimum', () => {
      expect(getEIP7702MiniGasLimit(60001)).toBe('0xea61');
    });

    it('treats empty-like values as zero and still applies the minimum', () => {
      expect(getEIP7702MiniGasLimit('')).toBe(
        `0x${EIP7702RevokeMiniGasLimit.toString(16)}`,
      );
    });
  });
});
