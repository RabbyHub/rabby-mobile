import {
  createPerpsProKeyboardSession,
  getPerpsProKeyboardAccessoryTop,
} from './perpsProKeyboardSession';

describe('Pro keyboard focus ownership', () => {
  it('ignores a late blur and hint update from the previous input', () => {
    const session = createPerpsProKeyboardSession();
    const input = {
      blur: jest.fn(),
      isFocused: () => true,
      measureInWindow: jest.fn(),
    };
    session.setEnabled(true);
    session.focus({
      id: 'amount',
      input,
      minimum: '15.35 USDC',
      scrollTrade: true,
    });
    session.focus({ id: 'price', input, minimum: null, scrollTrade: false });
    session.blur('amount');
    session.updateMinimum('amount', '10 USDC');
    expect(session.getSnapshot()).toMatchObject({ id: 'price', minimum: null });
    session.setEnabled(false);
    expect(input.blur).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBeNull();
  });

  it('does not publish identical hints and unregisters observers', () => {
    const session = createPerpsProKeyboardSession();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);
    session.setEnabled(true);
    session.focus({
      id: 'amount',
      input: {
        blur: jest.fn(),
        isFocused: () => true,
        measureInWindow: jest.fn(),
      },
      minimum: '10 USDC',
      scrollTrade: true,
    });
    session.updateMinimum('amount', '10 USDC');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    session.blur('amount');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('converts keyboard screen coordinates once, including an already-panned window', () => {
    expect(getPerpsProKeyboardAccessoryTop(560, 24)).toBe(488);
    expect(getPerpsProKeyboardAccessoryTop(560, -160)).toBe(672);
    expect(getPerpsProKeyboardAccessoryTop(20, 24)).toBe(0);
  });
});
