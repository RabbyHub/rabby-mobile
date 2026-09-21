import { TokenProjectionPersistenceGate } from './tokenProjectionPersistenceGate';

describe('TokenProjectionPersistenceGate', () => {
  it('defers a projection until every referenced address is persisted', () => {
    const gate = new TokenProjectionPersistenceGate();
    const persist = jest.fn();
    const ticket = gate.markDirty(['0xA', '0xB']);

    expect(gate.schedule('multi', ['0xa', '0xb'], persist)).toBe(false);
    gate.settle(ticket, { addresses: ['0xA'], success: true });
    expect(persist).not.toHaveBeenCalled();

    gate.settle(ticket, { addresses: ['0xB'], success: true });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('keeps only the newest deferred projection for a key', () => {
    const gate = new TokenProjectionPersistenceGate();
    const first = jest.fn();
    const latest = jest.fn();
    const ticket = gate.markDirty(['0xA']);

    gate.schedule('single', ['0xA'], first);
    gate.schedule('single', ['0xA'], latest);
    gate.settle(ticket, { success: true });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('does not let an older completion release a newer in-memory version', () => {
    const gate = new TokenProjectionPersistenceGate();
    const persist = jest.fn();
    const oldTicket = gate.markDirty(['0xA']);
    const latestTicket = gate.markDirty(['0xA']);

    gate.schedule('single', ['0xA'], persist);
    gate.settle(oldTicket, { success: true });
    expect(persist).not.toHaveBeenCalled();

    gate.settle(latestTicket, { success: true });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('retains the last persisted projection when entity persistence fails', () => {
    const gate = new TokenProjectionPersistenceGate();
    const persist = jest.fn();
    const ticket = gate.markDirty(['0xA']);

    gate.schedule('single', ['0xA'], persist);
    gate.settle(ticket, { success: false });

    expect(persist).not.toHaveBeenCalled();
  });

  it('drops pending work when database synchronization is aborted', () => {
    const gate = new TokenProjectionPersistenceGate();
    const persist = jest.fn();
    const ticket = gate.markDirty(['0xA']);

    gate.schedule('single', ['0xA'], persist);
    gate.clear();
    gate.settle(ticket, { success: true });

    expect(persist).not.toHaveBeenCalled();
  });
});
