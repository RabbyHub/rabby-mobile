import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  contactService,
  keyringService,
  whitelistService,
} from '@/core/services';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { removeCexId } from '@/utils/addressCexId';
import { isAddrInWhitelist, setWhitelist, useWhitelist } from './whitelist';

type MockRecord = { address: string; addedAt?: number };

let mockRecords: MockRecord[] = [];
let mockWhitelistEnabled = false;

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/components/AuthenticationModal/AuthenticationModal', () => ({
  AuthenticationModal: {
    show: jest.fn(({ onFinished }) => onFinished?.()),
  },
}));

jest.mock('@/components/AuthenticationModal/AuthenticationModal2024', () => ({
  AuthenticationModal2024: {
    show: jest.fn(({ onFinished }) => onFinished?.()),
  },
}));

jest.mock('@/core/apis', () => ({
  apisLock: {
    verifyPasswordOrUnlock: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('@/core/services', () => ({
  contactService: {
    removeAlias: jest.fn(),
  },
  keyringService: {
    hasAddress: jest.fn(() => Promise.resolve(false)),
  },
  whitelistService: {
    addWhitelist: jest.fn((address: string) => {
      mockRecords = [{ address: address.toLowerCase(), addedAt: 1 }];
    }),
    removeWhitelist: jest.fn((address: string) => {
      mockRecords = mockRecords.filter(
        item => item.address.toLowerCase() !== address.toLowerCase(),
      );
    }),
    setWhitelist: jest.fn((addresses: string[]) => {
      mockRecords = addresses.map((address, index) => ({
        address,
        addedAt: index + 1,
      }));
    }),
    getWhitelistRecords: jest.fn(() => [...mockRecords]),
    isWhitelistEnabled: jest.fn(() => Promise.resolve(mockWhitelistEnabled)),
    enableWhitelist: jest.fn(() => {
      mockWhitelistEnabled = true;
      return Promise.resolve();
    }),
    disableWhiteList: jest.fn(() => {
      mockWhitelistEnabled = false;
      return Promise.resolve();
    }),
  },
}));

jest.mock('@rabby-wallet/base-utils', () => ({
  addressUtils: {
    isSameAddress: (a?: string, b?: string) => {
      return !!a && !!b && a.toLowerCase() === b.toLowerCase();
    },
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

jest.mock('@/utils/addressCexId', () => ({
  removeCexId: jest.fn(),
}));

const addWhitelist = whitelistService.addWhitelist as jest.Mock;
const removeWhitelistService = whitelistService.removeWhitelist as jest.Mock;
const setWhitelistService = whitelistService.setWhitelist as jest.Mock;
const enableWhitelist = whitelistService.enableWhitelist as jest.Mock;
const disableWhiteList = whitelistService.disableWhiteList as jest.Mock;
const hasAddress = keyringService.hasAddress as jest.Mock;
const removeAlias = contactService.removeAlias as jest.Mock;
const removeCexIdMock = removeCexId as jest.Mock;
const authenticationShow = AuthenticationModal.show as jest.Mock;
const authentication2024Show = AuthenticationModal2024.show as jest.Mock;

describe('whitelist hook', () => {
  beforeEach(async () => {
    mockRecords = [];
    mockWhitelistEnabled = false;
    jest.clearAllMocks();

    await act(async () => {
      await setWhitelist([]);
    });
  });

  it('checks string and record whitelist entries case-insensitively', () => {
    expect(
      isAddrInWhitelist('0xABC', ['0xdef', { address: '0xabc', addedAt: 1 }]),
    ).toBe(true);
    expect(isAddrInWhitelist('', [{ address: '0xabc' }])).toBe(false);
    expect(isAddrInWhitelist('0x123', [{ address: '0xabc' }])).toBe(false);
  });

  it('normalizes setWhitelist input and reflects it in hook state', async () => {
    const { result } = renderHook(() =>
      useWhitelist({ disableAutoFetch: true }),
    );

    await act(async () => {
      await result.current.setWhitelist([
        '0x1111111111111111111111111111111111111111',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222'.toUpperCase(),
      ]);
    });

    expect(setWhitelistService).toHaveBeenLastCalledWith([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
    expect(result.current.whitelist).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
  });

  it('adds an already validated address without showing the authentication modal', async () => {
    const onAdded = jest.fn();
    const { result } = renderHook(() =>
      useWhitelist({ disableAutoFetch: true }),
    );

    await act(async () => {
      await result.current.addWhitelist('0xABC', {
        hasValidated: true,
        onAdded,
      });
    });

    expect(addWhitelist).toHaveBeenCalledWith('0xABC');
    expect(authentication2024Show).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isAddrOnWhitelist('0xabc')).toBe(true);
    });
  });

  it('removes cex and contact metadata when no same address remains', async () => {
    mockRecords = [{ address: '0xabc', addedAt: 1 }];
    hasAddress.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useWhitelist({ disableAutoFetch: true }),
    );

    await act(async () => {
      await result.current.fetchWhitelist();
    });
    expect(result.current.whitelist).toEqual(['0xabc']);

    await act(async () => {
      await result.current.removeWhitelist('0xABC');
    });

    expect(removeWhitelistService).toHaveBeenCalledWith('0xABC');
    expect(removeCexIdMock).toHaveBeenCalledWith('0xABC');
    expect(removeAlias).toHaveBeenCalledWith('0xABC');
    expect(result.current.whitelist).toEqual([]);
  });

  it('toggles whitelist enablement through the authentication modal', async () => {
    const { result } = renderHook(() =>
      useWhitelist({ disableAutoFetch: true }),
    );

    await act(async () => {
      await result.current.toggleWhitelist(true);
    });

    expect(authenticationShow).toHaveBeenCalled();
    expect(enableWhitelist).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.whitelistEnabled).toBe(true);
    });

    await act(async () => {
      await result.current.toggleWhitelist(false);
    });

    expect(disableWhiteList).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.whitelistEnabled).toBe(false);
    });
  });
});
