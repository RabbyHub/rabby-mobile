import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { requestKeyring } from './keyring';
import { keyringService } from '../services';

jest.mock('../services', () => ({
  keyringService: {
    getKeyringForAccount: jest.fn(),
    getKeyringsByType: jest.fn(),
    getKeyringClassForType: jest.fn(),
  },
  notificationService: {
    setCurrentRequestDeferFn: jest.fn(),
  },
  preferenceService: {
    setCurrentAccount: jest.fn(),
  },
}));

jest.mock('../utils/getKeyringParams', () => ({
  getKeyringParams: jest.fn(() => ({})),
}));

jest.mock('@/utils/events', () => ({
  EVENTS: {
    SIGN_FINISHED: 'SIGN_FINISHED',
  },
  eventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('../utils/signEvent', () => ({
  waitSignComponentAmounted: jest.fn(() => Promise.resolve()),
}));

jest.mock('i18next', () => ({
  t: jest.fn((key: string) => key),
}));

describe('requestKeyring', () => {
  const mockedKeyringService = keyringService as jest.Mocked<
    typeof keyringService
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves getAccountInfo keyring by account address first', async () => {
    const keyringByAddress = {
      getAccountInfo: jest.fn(() => ({ index: 2 })),
    };
    const keyringByType = {
      getAccountInfo: jest.fn(() => ({ index: 999 })),
    };

    mockedKeyringService.getKeyringForAccount.mockResolvedValue(
      keyringByAddress as any,
    );
    mockedKeyringService.getKeyringsByType.mockReturnValue([
      keyringByType as any,
    ]);

    const result = await requestKeyring(
      KEYRING_TYPE.KeystoneKeyring,
      'getAccountInfo',
      null,
      '0xabc',
    );

    expect(mockedKeyringService.getKeyringForAccount).toHaveBeenCalledWith(
      '0xabc',
      KEYRING_TYPE.KeystoneKeyring,
    );
    expect(keyringByAddress.getAccountInfo).toHaveBeenCalledWith('0xabc');
    expect(keyringByType.getAccountInfo).not.toHaveBeenCalled();
    expect(result).toEqual({ index: 2 });
  });

  it('falls back to type-based keyring lookup when address lookup fails', async () => {
    const keyringByType = {
      getAccountInfo: jest.fn(() => ({ index: 7 })),
    };

    mockedKeyringService.getKeyringForAccount.mockRejectedValue(
      new Error('No keyring for address'),
    );
    mockedKeyringService.getKeyringsByType.mockReturnValue([
      keyringByType as any,
    ]);

    const result = await requestKeyring(
      KEYRING_TYPE.KeystoneKeyring,
      'getAccountInfo',
      null,
      '0xdef',
    );

    expect(mockedKeyringService.getKeyringForAccount).toHaveBeenCalledWith(
      '0xdef',
      KEYRING_TYPE.KeystoneKeyring,
    );
    expect(keyringByType.getAccountInfo).toHaveBeenCalledWith('0xdef');
    expect(result).toEqual({ index: 7 });
  });

  it('keeps legacy behavior for methods other than getAccountInfo', async () => {
    const keyringByType = {
      getAddresses: jest.fn(() => ['0x1']),
    };

    mockedKeyringService.getKeyringsByType.mockReturnValue([
      keyringByType as any,
    ]);

    const result = await requestKeyring(
      KEYRING_TYPE.KeystoneKeyring,
      'getAddresses',
      null,
      0,
      1,
    );

    expect(mockedKeyringService.getKeyringForAccount).not.toHaveBeenCalled();
    expect(keyringByType.getAddresses).toHaveBeenCalledWith(0, 1);
    expect(result).toEqual(['0x1']);
  });
});
