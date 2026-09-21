import { act, renderHook } from '@testing-library/react-native';

const mockApprovalStatus = jest.fn();

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/request', () => ({
  openapi: {
    approvalStatus: (...args: unknown[]) => mockApprovalStatus(...args),
  },
}));

jest.mock('@/hooks/account', () => ({
  storeApiAccounts: {},
  useAccounts: jest.fn(),
}));

import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useApprovalAlert } from './approvals';

describe('useApprovalAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads only on demand and never exposes another account result', async () => {
    mockApprovalStatus.mockResolvedValue([
      {
        nft_approval_danger_cnt: 2,
        token_approval_danger_cnt: 3,
      },
    ]);
    const account = {
      address: '0x0000000000000000000000000000000000000001',
      type: KEYRING_TYPE.SimpleKeyring,
      brandName: 'Rabby',
    };
    const { result, rerender } = renderHook(
      ({ currentAccount }) => useApprovalAlert({ account: currentAccount }),
      { initialProps: { currentAccount: account } },
    );

    expect(mockApprovalStatus).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadApprovalStatus();
    });

    expect(mockApprovalStatus).toHaveBeenCalledTimes(1);
    expect(mockApprovalStatus).toHaveBeenCalledWith(account.address);
    expect(result.current.approvalRiskAlert).toBe(5);

    rerender({
      currentAccount: {
        ...account,
        address: '0x0000000000000000000000000000000000000002',
      },
    });
    expect(result.current.approvalRiskAlert).toBe(0);
    expect(mockApprovalStatus).toHaveBeenCalledTimes(1);
  });
});
