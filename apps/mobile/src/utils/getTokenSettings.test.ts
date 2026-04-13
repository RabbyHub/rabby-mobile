const mockGetUserTokenSettings = jest.fn();

jest.mock('@/core/services', () => ({
  preferenceService: {
    getUserTokenSettings: (...args: unknown[]) =>
      mockGetUserTokenSettings(...args),
  },
}));

import { getTokenSettings } from './getTokenSettings';

describe('getTokenSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('currently returns empty token and protocol overrides even when preferences contain values', async () => {
    mockGetUserTokenSettings.mockResolvedValue({
      includeDefiAndTokens: ['token-1'],
      excludeDefiAndTokens: ['token-2'],
    });

    await expect(getTokenSettings()).resolves.toEqual({
      included_token_uuids: [],
      excluded_token_uuids: [],
      excluded_protocol_ids: [],
      excluded_chain_ids: [],
    });
  });
});
