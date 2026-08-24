import { createAutoUnlockGate } from './autoUnlockGate';

describe('createAutoUnlockGate', () => {
  let atUnlock = true;
  let dispatch: jest.Mock;
  let gate: ReturnType<typeof createAutoUnlockGate>;

  beforeEach(() => {
    atUnlock = true;
    dispatch = jest.fn();
    gate = createAutoUnlockGate({
      isAtUnlock: () => atUnlock,
      dispatch,
    });
  });

  it('waits for the unlock listener and prompt presentation boundary', () => {
    gate.request();

    expect(dispatch).not.toHaveBeenCalled();

    gate.setScreenReady(true);

    expect(dispatch).not.toHaveBeenCalled();

    gate.setPresentationReady(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not retain a request after the unlock screen is removed', () => {
    gate.request();
    gate.setScreenReady(false);
    atUnlock = false;

    gate.setScreenReady(true);
    gate.setPresentationReady(true);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps the committed screen ready across a lock-state reset', () => {
    gate.setScreenReady(true);
    gate.setPresentationReady(true);
    gate.clearPending();

    gate.request();

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('dispatches once navigation reaches an already committed unlock screen', () => {
    atUnlock = false;
    gate.setScreenReady(true);
    gate.setPresentationReady(true);
    gate.request();

    expect(dispatch).not.toHaveBeenCalled();

    atUnlock = true;
    gate.dispatchIfReady();

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not create a pending request outside the unlock route', () => {
    atUnlock = false;

    gate.request();
    gate.setScreenReady(true);
    gate.setPresentationReady(true);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch before iOS marks the presentation boundary ready', () => {
    gate.setScreenReady(true);
    gate.request();

    expect(dispatch).not.toHaveBeenCalled();

    gate.setPresentationReady(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
