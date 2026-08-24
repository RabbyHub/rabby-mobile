const mockDangerouslyResetPasswordAndKeyrings = jest.fn();
const mockResetGenericPassword = jest.fn();
const mockRemoveRegressionScenarioSession = jest.fn();
const mockClearRegressionScenarioRuntime = jest.fn();

jest.mock('@/constant/encryptor', () => ({
  RABBY_MOBILE_KR_PWD: 'built-in-password',
}));
jest.mock('@/core/apis', () => ({
  apisLock: {
    dangerouslyResetPasswordAndKeyrings: (...args: unknown[]) =>
      mockDangerouslyResetPasswordAndKeyrings(...args),
  },
  apisKeychain: {
    resetGenericPassword: (...args: unknown[]) =>
      mockResetGenericPassword(...args),
  },
}));
jest.mock('./credentials.nonprod', () => ({
  REGRESSION_DEFAULT_PASSWORD: '11111111',
}));
jest.mock('./sessionStore', () => ({
  removeRegressionScenarioSession: () => mockRemoveRegressionScenarioSession(),
}));
jest.mock('./runtimeStore', () => ({
  clearRegressionScenarioRuntime: () => mockClearRegressionScenarioRuntime(),
}));

import { resetRegressionWalletCredentials } from './reset.nonprod';

describe('resetRegressionWalletCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDangerouslyResetPasswordAndKeyrings.mockResolvedValue({ error: '' });
    mockResetGenericPassword.mockResolvedValue(true);
  });

  it('clears test keyrings, native password material and scenario state', async () => {
    await resetRegressionWalletCredentials();

    expect(mockDangerouslyResetPasswordAndKeyrings).toHaveBeenCalledWith(
      '11111111',
      'built-in-password',
    );
    expect(mockResetGenericPassword).toHaveBeenCalledTimes(1);
    expect(mockRemoveRegressionScenarioSession).toHaveBeenCalledTimes(1);
    expect(mockClearRegressionScenarioRuntime).toHaveBeenCalledTimes(1);
  });

  it('stops before clearing native password material when keyring reset fails', async () => {
    mockDangerouslyResetPasswordAndKeyrings.mockResolvedValue({
      error: 'invalid test password',
    });

    await expect(resetRegressionWalletCredentials()).rejects.toThrow(
      'invalid test password',
    );
    expect(mockResetGenericPassword).not.toHaveBeenCalled();
    expect(mockRemoveRegressionScenarioSession).not.toHaveBeenCalled();
  });
});
