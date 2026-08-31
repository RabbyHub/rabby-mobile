import { Abstraction } from '@rabby-wallet/hyperliquid-sdk';

import { setPerpsAgentUnifiedAccount } from './setAgentUnifiedAccount';

describe('setPerpsAgentUnifiedAccount', () => {
  it('preserves the existing post-approval automatic Unified policy', async () => {
    const agentSetAbstraction = jest.fn(async () => ({ status: 'ok' }));

    await expect(
      setPerpsAgentUnifiedAccount({ agentSetAbstraction }),
    ).resolves.toEqual({ status: 'ok' });
    expect(agentSetAbstraction).toHaveBeenCalledTimes(1);
    expect(agentSetAbstraction).toHaveBeenCalledWith(
      Abstraction.UNIFIED_ACCOUNT,
    );
  });

  it('rejects missing clients and non-ok responses', async () => {
    await expect(setPerpsAgentUnifiedAccount(undefined)).rejects.toThrow(
      'Hyperliquid exchange client unavailable',
    );
    await expect(
      setPerpsAgentUnifiedAccount({
        agentSetAbstraction: jest.fn(async () => ({ status: 'err' })),
      }),
    ).rejects.toThrow('Hyperliquid rejected Unified Account configuration');
  });
});
