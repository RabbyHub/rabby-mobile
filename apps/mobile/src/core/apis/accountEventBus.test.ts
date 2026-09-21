import { AccountEventBus, MAX_PENDING_ACCOUNT_ADDED } from './accountEventBus';

function makeCtx(address: string) {
  return {
    accounts: [{ address, type: 'HD Key Tree', brandName: 'MNEMONIC' }],
    scene: 'memonics' as const,
    needsBackupReminder: true,
  };
}

describe('AccountEventBus', () => {
  it('replays ACCOUNT_ADDED emitted before any listener was registered', () => {
    const bus = new AccountEventBus();
    bus.emit('ACCOUNT_ADDED', makeCtx('0x1'));
    bus.emit('ACCOUNT_ADDED', makeCtx('0x2'));

    const listener = jest.fn();
    bus.on('ACCOUNT_ADDED', listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0]).toEqual(makeCtx('0x1'));
    expect(listener.mock.calls[1][0]).toEqual(makeCtx('0x2'));
  });

  it('replays buffered events to subscribe() as well', () => {
    const bus = new AccountEventBus();
    bus.emit('ACCOUNT_ADDED', makeCtx('0x1'));

    const listener = jest.fn();
    const { remove } = bus.subscribe('ACCOUNT_ADDED', listener);

    expect(listener).toHaveBeenCalledTimes(1);
    remove();
  });

  it('does not replay to later listeners once the buffer is drained', () => {
    const bus = new AccountEventBus();
    bus.emit('ACCOUNT_ADDED', makeCtx('0x1'));

    const first = jest.fn();
    bus.on('ACCOUNT_ADDED', first);
    const second = jest.fn();
    bus.on('ACCOUNT_ADDED', second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('delivers directly once a listener exists', () => {
    const bus = new AccountEventBus();
    const listener = jest.fn();
    bus.on('ACCOUNT_ADDED', listener);

    bus.emit('ACCOUNT_ADDED', makeCtx('0x1'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('caps the pending buffer', () => {
    const bus = new AccountEventBus();
    for (let i = 0; i < MAX_PENDING_ACCOUNT_ADDED + 5; i++) {
      bus.emit('ACCOUNT_ADDED', makeCtx(`0x${i}`));
    }

    const listener = jest.fn();
    bus.on('ACCOUNT_ADDED', listener);

    expect(listener).toHaveBeenCalledTimes(MAX_PENDING_ACCOUNT_ADDED);
  });

  it('does not buffer other events', () => {
    const bus = new AccountEventBus();
    bus.emit('ACCOUNT_REMOVED', { removedAccounts: [] });

    const listener = jest.fn();
    bus.on('ACCOUNT_REMOVED', listener);

    expect(listener).not.toHaveBeenCalled();
  });
});
