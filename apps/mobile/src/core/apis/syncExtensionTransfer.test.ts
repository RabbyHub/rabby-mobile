import { getContactAliasMapSnapshot } from '@/core/serviceApi/contact';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { getPinnedAddressSnapshot } from '@/core/serviceApi/preference';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';

import { getSyncTransferDataString } from './syncExtensionTransfer';

jest.mock('@/core/serviceApi/contact', () => ({
  getContactAliasMapSnapshot: jest.fn(),
}));
jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: { getSyncVault: jest.fn() },
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getPinnedAddressSnapshot: jest.fn(),
}));
jest.mock('@/core/serviceApi/whitelist', () => ({
  whitelistServiceApi: { getWhitelist: jest.fn() },
}));

const SELECTED_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_ADDRESS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('getSyncTransferDataString', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(keyringServiceApi.getSyncVault).mockResolvedValue({
      vault: JSON.stringify({ data: 'encrypted', iv: 'iv', salt: 'salt' }),
      accounts: [SELECTED_ADDRESS],
    });
    jest
      .mocked(whitelistServiceApi.getWhitelist)
      .mockResolvedValue([SELECTED_ADDRESS.toUpperCase(), OTHER_ADDRESS]);
    jest.mocked(getPinnedAddressSnapshot).mockReturnValue([
      { address: SELECTED_ADDRESS, brandName: 'Rabby' },
      { address: OTHER_ADDRESS, brandName: 'Watch' },
    ]);
    jest.mocked(getContactAliasMapSnapshot).mockReturnValue({
      [SELECTED_ADDRESS]: {
        address: SELECTED_ADDRESS,
        alias: 'Selected wallet',
        isDefaultAlias: false,
      },
      [OTHER_ADDRESS]: {
        address: OTHER_ADDRESS,
        alias: 'Other wallet',
        isDefaultAlias: false,
      },
    } as ReturnType<typeof getContactAliasMapSnapshot>);
  });

  it('matches the extension envelope and filters metadata to exported accounts', async () => {
    const selectedAccounts = [
      {
        address: SELECTED_ADDRESS,
        brandName: 'Rabby',
        type: 'Simple Key Pair',
      },
    ] as any;

    const result = JSON.parse(
      await getSyncTransferDataString(selectedAccounts),
    );

    expect(keyringServiceApi.getSyncVault).toHaveBeenCalledWith(
      selectedAccounts,
    );
    expect(result).toStrictEqual({
      format: 'rabby-wallet-transfer',
      version: 1,
      vault: { data: 'encrypted', iv: 'iv', salt: 'salt' },
      whitelist: [SELECTED_ADDRESS.toUpperCase()],
      highligtedAddresses: [{ address: SELECTED_ADDRESS, brandName: 'Rabby' }],
      alianNames: [{ address: SELECTED_ADDRESS, name: 'Selected wallet' }],
    });
  });
});
