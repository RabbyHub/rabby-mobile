const mockGetAliasByAddress = jest.fn();
const mockGetContactsByMap = jest.fn();

jest.mock('../services', () => ({
  contactService: {
    getAliasByAddress: (...args: unknown[]) => mockGetAliasByAddress(...args),
    getContactsByMap: (...args: unknown[]) => mockGetContactsByMap(...args),
  },
}));

import { getAliasName, getContactsByAddress } from './contact';

describe('core/apis/contact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns alias text and preserves lookup options', () => {
    mockGetAliasByAddress.mockReturnValue({
      alias: 'Main wallet',
    });

    expect(getAliasName('0xABC', { fallbackToAddr: false } as never)).toBe(
      'Main wallet',
    );
    expect(mockGetAliasByAddress).toHaveBeenCalledWith('0xABC', {
      fallbackToAddr: false,
    });
  });

  it('returns undefined when no alias item exists', () => {
    mockGetAliasByAddress.mockReturnValue(undefined);

    expect(getAliasName('0xABC')).toBeUndefined();
  });

  it('normalizes contact addresses to lowercase in the returned map', () => {
    const contacts = {
      a: {
        name: 'Alice',
        address: '0xABCDEF',
      },
      b: {
        name: 'Empty',
        address: '',
      },
    };
    mockGetContactsByMap.mockReturnValue(contacts);

    expect(getContactsByAddress()).toBe(contacts);
    expect(contacts).toEqual({
      a: {
        name: 'Alice',
        address: '0xabcdef',
      },
      b: {
        name: 'Empty',
        address: '',
      },
    });
  });
});
