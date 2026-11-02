const mockIsBlockedAddress = jest.fn();

jest.mock('../request', () => ({
  openapi: {
    isBlockedAddress: (...args: unknown[]) => mockIsBlockedAddress(...args),
  },
}));

import { clearBlockedAddressCache, hasBlockedAddress } from './blockedAddress';

const SENDER = '0x1111111111111111111111111111111111111111';
const RECEIVER = '0xAbCdEf0000000000000000000000000000000002';

describe('hasBlockedAddress', () => {
  beforeEach(() => {
    mockIsBlockedAddress.mockReset();
    clearBlockedAddressCache();
  });

  it('asks the API once per address regardless of case or concurrency', async () => {
    mockIsBlockedAddress.mockResolvedValue({ is_blocked: false });

    const results = await Promise.all([
      hasBlockedAddress([RECEIVER, RECEIVER.toLowerCase(), undefined, '']),
      hasBlockedAddress([RECEIVER.toUpperCase().replace('0X', '0x')]),
    ]);
    await hasBlockedAddress([RECEIVER]);

    expect(results).toEqual([false, false]);
    expect(mockIsBlockedAddress).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedAddress).toHaveBeenCalledWith(RECEIVER.toLowerCase());
  });

  it('asks again after the cached answer expires', async () => {
    // lru-cache reads its clock from the `performance` object it saw at import.
    const now = performance.now();
    const clock = jest.spyOn(performance, 'now').mockReturnValue(now);
    mockIsBlockedAddress.mockResolvedValue({ is_blocked: false });

    await hasBlockedAddress([SENDER]);
    clock.mockReturnValue(now + 5 * 60 * 1000 + 1);
    // lru-cache also memoizes "now" for ~1ms.
    await new Promise(resolve => setTimeout(resolve, 5));
    await hasBlockedAddress([SENDER]);
    clock.mockRestore();

    expect(mockIsBlockedAddress).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed lookup', async () => {
    mockIsBlockedAddress
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ is_blocked: true });

    await expect(hasBlockedAddress([SENDER])).resolves.toBe(false);
    await expect(hasBlockedAddress([SENDER])).resolves.toBe(true);
    expect(mockIsBlockedAddress).toHaveBeenCalledTimes(2);
  });

  it('does not let a failed lookup hide a blocked address', async () => {
    mockIsBlockedAddress.mockImplementation(async (address: string) => {
      if (address === RECEIVER.toLowerCase()) throw new Error('network');
      return { is_blocked: true };
    });

    await expect(hasBlockedAddress([RECEIVER, SENDER])).resolves.toBe(true);
  });
});
