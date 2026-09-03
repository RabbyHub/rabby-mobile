const mockEnsureApproval = jest.fn(async () => undefined);
const mockInvalidateApproval = jest.fn();
const mockSetApproveAgent = jest.fn();

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'Ledger Hardware',
} as const;

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getAgentWalletPreference: jest.fn(async () => ({
      agentAddress: '0x0000000000000000000000000000000000000002',
    })),
    isSelfSignPerpsAccount: () => false,
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: () => ({ currentPerpsAccount: mockAccount }) },
  setAccountNeedApproveAgent: (...args: unknown[]) =>
    mockSetApproveAgent(...args),
  setAccountNeedApproveBuilderFee: jest.fn(),
}));

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
  invalidatePerpsActionApprovalCache: () => mockInvalidateApproval(),
}));

jest.mock('@/hooks/perps/showToast', () => ({ showToast: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

import { judgeIsUserAgentIsExpired } from './perpsActionError';

describe('Perps action expired-agent recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates approval for the next attempt without reentering it immediately', async () => {
    await expect(
      judgeIsUserAgentIsExpired(
        'API wallet 0x0000000000000000000000000000000000000002 does not exist',
      ),
    ).resolves.toBe(true);

    expect(mockSetApproveAgent).toHaveBeenCalledWith(true);
    expect(mockInvalidateApproval).toHaveBeenCalledTimes(1);
    expect(mockEnsureApproval).not.toHaveBeenCalled();
  });

  it('does not authorize for an unrelated action error', async () => {
    await expect(
      judgeIsUserAgentIsExpired('Insufficient margin'),
    ).resolves.toBe(false);

    expect(mockEnsureApproval).not.toHaveBeenCalled();
  });
});
