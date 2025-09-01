import * as sinon from 'sinon';
import WatchKeyring from './WatchKeyring';

const STATE = { name: 'foo' };
const CONFIG = { disabled: true };

describe('WatchKeyring', () => {
  const VALID_EOA = '0x7a16Bb6702bF5B06aFe7Bf5c7E116A89E87EfF1A';
  const VALID_EOAS = [
    '0x7a16Bb6702bF5B06aFe7Bf5c7E116A89E87EfF1A',
    '0x7a16Bb6702bF5B06aFe7Bf5c7E116A89E87EfF1B'
  ];

  let watchKeyring: WatchKeyring;

  beforeEach(() => {
    watchKeyring = new WatchKeyring();
  });

  it('should add valid account', async () => {
    const accountToAdd = VALID_EOA;
    watchKeyring.setAccountToAdd(accountToAdd)
    await expect(watchKeyring.addAccounts()).resolves.toEqual([
      VALID_EOA,
    ]);
  });

  it('should throw error when adding invalid account', async () => {
    const invalidAccount = 'InvalidAddress';
    watchKeyring.setAccountToAdd(invalidAccount)
    await expect(watchKeyring.addAccounts()).rejects.toThrow(
      "The address you're trying to import is invalid"
    );
  });

  it('should throw error when adding duplicate account', async () => {
    const validAccount = VALID_EOA;
    watchKeyring.accounts = [VALID_EOA];

    watchKeyring.setAccountToAdd(validAccount)
    await expect(watchKeyring.addAccounts()).rejects.toThrow(
      "The address you're trying to import is duplicated"
    );
  });

  it('should get accounts', async () => {
    watchKeyring.accounts = [...VALID_EOAS];
    const accounts = await watchKeyring.getAccounts();
    expect(accounts).toEqual([...VALID_EOAS]);
  });

  it('should remove account', () => {
    watchKeyring.accounts = [...VALID_EOAS];
    watchKeyring.removeAccount(VALID_EOAS[0]);
    expect(watchKeyring.accounts).toEqual([VALID_EOAS[1]]);
  });

  it('should throw error when remove account not found', () => {
    watchKeyring.accounts = [...VALID_EOAS];
    expect(() => watchKeyring.removeAccount('0xInvalidAccount')).toThrow(
      'Address 0xInvalidAccount not found in watch keyring'
    );
  });

  it('should throw error when signing transaction', async () => {
    const address = VALID_EOA;
    const transaction = {}; // Transaction object
    await expect(watchKeyring.signTransaction(address, transaction)).rejects.toThrow(
      'Can not sign with watch address'
    );
  });

  it('should throw error when signing personal message', async () => {
    const address: string = VALID_EOA;
    const message: string = 'Test message';
    await expect(watchKeyring.signPersonalMessage(address, message)).rejects.toThrow(
      'Can not sign with watch address'
    );
  });

  it('should throw error when signing typed data', async () => {
    const address: string = VALID_EOA;
    const data: any = {}; // Typed data object
    await expect(watchKeyring.signTypedData(address, data)).rejects.toThrow(
      'Can not sign with watch address'
    );
  });

  it('should serialize accounts', async () => {
    watchKeyring.accounts = [...VALID_EOAS];
    const serializedData = await watchKeyring.serialize();
    expect(serializedData).toEqual({ accounts: [...VALID_EOAS] });
  });

  describe('#deserialize', () => {
    it('allow empty accounts', async () => {
      await watchKeyring.deserialize();
      expect(watchKeyring.accounts).toEqual([]);

      await watchKeyring.deserialize({});
      expect(watchKeyring.accounts).toEqual([]);
    });

    it('should deserialize accounts', async () => {
      await watchKeyring.deserialize({ accounts: [...VALID_EOAS] });
      expect(watchKeyring.accounts).toEqual([...VALID_EOAS]);
    });
  });

  describe('#_normalize', () => {
    it('should normalize string', () => {
      expect(watchKeyring._normalize('abcdef')).toEqual('0xabcdef');
      expect(watchKeyring._normalize('0xabcdef')).toEqual('0xabcdef');
      expect(watchKeyring._normalize('0xabcdefh')).toEqual('0x0abcdefh');
    });

    it('should normalize buffer', () => {
      expect(watchKeyring._normalize(Buffer.from('abcdef', 'hex'))).toEqual('0xabcdef');
    });

    it('should normalize empty buffer', () => {
      const emptyBuf: Buffer = Buffer.from('', 'hex');
      const normalizedEmpty: string = watchKeyring._normalize(emptyBuf);
      expect(normalizedEmpty).toEqual('');
    });
  });
});
