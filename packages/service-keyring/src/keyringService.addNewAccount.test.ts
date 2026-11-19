import { KeyringService } from '../src/keyringService';
import mockEncryptor from '../test/mock-encryptor';
import { KEYRING_TYPE, KeyringTypeName } from '@rabby-wallet/keyring-utils';

const password = 'password123';

const ADDR_1 = '0x39b97205b9826f21fd39b535cf972c809e160e5f';
const ADDR_2 = '0x2222222222222222222222222222222222222222';
const ADDR_3 = '0x3333333333333333333333333333333333333333';

const toAddress = (account: string | { address: string }) =>
  (typeof account === 'string' ? account : account.address).toLowerCase();

describe('KeyringService.addNewAccount', () => {
  let keyringService: KeyringService;
  let onSetAddressAlias: jest.Mock;

  beforeEach(async () => {
    onSetAddressAlias = jest.fn(async () => undefined);
    keyringService = new KeyringService({
      encryptor: mockEncryptor as any,
      onSetAddressAlias,
    });
    keyringService.loadStore({});
    await keyringService.boot(password);
    await keyringService.clearKeyrings();
  });

  afterEach(() => {
    keyringService.removeAllListeners();
  });

  async function addToSameKeyring(addresses: string[]) {
    const keyring = await keyringService.addNewKeyring(
      KEYRING_TYPE.WatchAddressKeyring as KeyringTypeName,
    );
    const results: (string | { address: string })[][] = [];
    for (const address of addresses) {
      keyring.setAccountToAdd(address);
      results.push(
        (await keyringService.addNewAccount(keyring)) as (
          | string
          | { address: string }
        )[],
      );
    }
    return { keyring, results };
  }

  it('returns only the account added by this call when the keyring already holds accounts', async () => {
    const { keyring, results } = await addToSameKeyring([
      ADDR_1,
      ADDR_2,
      ADDR_3,
    ]);

    expect(results.map(r => r.map(toAddress))).toEqual([
      [ADDR_1],
      [ADDR_2],
      [ADDR_3],
    ]);
    expect((await keyring.getAccounts()).map(toAddress)).toEqual([
      ADDR_1,
      ADDR_2,
      ADDR_3,
    ]);
  });

  it('emits newAccount and sets alias only for the newly added account', async () => {
    const { keyring } = await addToSameKeyring([ADDR_1, ADDR_2]);

    const newAccountSpy = jest.fn();
    keyringService.on('newAccount', newAccountSpy);
    onSetAddressAlias.mockClear();

    keyring.setAccountToAdd(ADDR_3);
    await keyringService.addNewAccount(keyring);

    expect(newAccountSpy).toHaveBeenCalledTimes(1);
    expect(toAddress(newAccountSpy.mock.calls[0][0])).toBe(ADDR_3);
    expect(onSetAddressAlias).toHaveBeenCalledTimes(1);
    expect(toAddress(onSetAddressAlias.mock.calls[0][1])).toBe(ADDR_3);
  });
});
