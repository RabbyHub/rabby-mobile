type Subject = {
  reportLendingUserStatusOnce: (params: {
    addresses: string[];
    protocolMap: Record<string, any[]>;
  }) => void;
  matomoRequestEvent: jest.Mock;
};

const protocol = (id: string, owner_addr?: string) => ({
  id,
  owner_addr,
});

const loadSubject = (): Subject => {
  jest.resetModules();
  const matomoRequestEvent = jest.fn();
  jest.doMock('@/utils/analytics', () => ({
    matomoRequestEvent,
  }));
  const { reportLendingUserStatusOnce } = require('./lendingUserStatus');
  return {
    reportLendingUserStatusOnce,
    matomoRequestEvent,
  };
};

describe('reportLendingUserStatusOnce', () => {
  afterEach(() => {
    jest.dontMock('@/utils/analytics');
    jest.resetModules();
  });

  it('reports SC_SA for one address in one Aave market', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa'],
      protocolMap: {
        '0xaaaa': [protocol('aave3', '0xAAAA')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledWith({
      category: 'Rabby Lending',
      action: 'Lending_UserStatus',
      label: 'SC_SA',
    });
  });

  it('reports MC_SA for one address across multiple Aave markets', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa'],
      protocolMap: {
        '0xaaaa': [protocol('aave3', '0xaaaa'), protocol('op_aave3', '0xaaaa')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'MC_SA' }),
    );
  });

  it('reports SC_MA for multiple addresses in the same Aave market', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa', '0xBbBb'],
      protocolMap: {
        '0xaaaa': [protocol('aave3', '0xaaaa')],
        '0xbbbb': [protocol('aave3', '0xbbbb')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'SC_MA' }),
    );
  });

  it('reports MC_MA for multiple addresses across multiple Aave markets', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa', '0xBbBb'],
      protocolMap: {
        '0xaaaa': [protocol('aave3', '0xaaaa')],
        '0xbbbb': [protocol('base_aave3', '0xbbbb')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'MC_MA' }),
    );
  });

  it('ignores non-Aave protocols and protocols outside the selected owners', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa'],
      protocolMap: {
        '0xaaaa': [
          protocol('compound3', '0xaaaa'),
          protocol('aave3', '0xbbbb'),
        ],
        '0xbbbb': [protocol('aave3', '0xbbbb')],
      },
    });

    expect(matomoRequestEvent).not.toHaveBeenCalled();
  });

  it('dedupes input addresses before resolving the owner count', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa', '0xaaaa'],
      protocolMap: {
        '0xaaaa': [protocol('aave3')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'SC_SA' }),
    );
  });

  it('reports at most once for the lifetime of the module', () => {
    const { reportLendingUserStatusOnce, matomoRequestEvent } = loadSubject();

    reportLendingUserStatusOnce({
      addresses: ['0xAaAa'],
      protocolMap: {
        '0xaaaa': [protocol('aave3')],
      },
    });
    reportLendingUserStatusOnce({
      addresses: ['0xAaAa', '0xBbBb'],
      protocolMap: {
        '0xaaaa': [protocol('aave3')],
        '0xbbbb': [protocol('base_aave3')],
      },
    });

    expect(matomoRequestEvent).toHaveBeenCalledTimes(1);
    expect(matomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'SC_SA' }),
    );
  });
});
