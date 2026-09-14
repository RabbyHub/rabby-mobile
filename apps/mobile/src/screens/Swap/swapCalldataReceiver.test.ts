import { isSwapCalldataReceiverAllowed } from './swapCalldataReceiver';

const USER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const ZERO = '0x0000000000000000000000000000000000000000';

describe('isSwapCalldataReceiverAllowed', () => {
  it('allows the current account', () => {
    expect(isSwapCalldataReceiverAllowed(USER, USER)).toBe(true);
    expect(
      isSwapCalldataReceiverAllowed(USER.toUpperCase(), USER.toLowerCase()),
    ).toBe(true);
  });

  it('rejects a third-party receiver', () => {
    expect(isSwapCalldataReceiverAllowed(OTHER, USER)).toBe(false);
  });

  it('treats the zero address as msg.sender', () => {
    expect(isSwapCalldataReceiverAllowed(ZERO, USER)).toBe(true);
  });

  it('skips the check when the decoder did not extract a receiver', () => {
    expect(isSwapCalldataReceiverAllowed(undefined, USER)).toBe(true);
    expect(isSwapCalldataReceiverAllowed('', USER)).toBe(true);
  });

  it('fails closed when a receiver is present but the user address is missing', () => {
    expect(isSwapCalldataReceiverAllowed(OTHER, undefined)).toBe(false);
  });
});
