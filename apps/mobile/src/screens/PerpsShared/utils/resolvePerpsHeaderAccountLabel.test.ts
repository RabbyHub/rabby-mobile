import { resolvePerpsHeaderAccountLabel } from './resolvePerpsHeaderAccountLabel';

const account = {
  address: '0x1234567890123456789012345678901234567890',
  aliasName: '',
};

describe('resolvePerpsHeaderAccountLabel', () => {
  it('uses one stable alias priority in both mode wrappers', () => {
    expect(
      resolvePerpsHeaderAccountLabel(
        { ...account, aliasName: 'Wallet alias' },
        'Contact alias',
      ),
    ).toBe('Wallet alias');
    expect(resolvePerpsHeaderAccountLabel(account, 'Contact alias')).toBe(
      'Contact alias',
    );
    expect(resolvePerpsHeaderAccountLabel(account)).toBe('0x123456...567890');
  });

  it('omits the trigger when there is no account address', () => {
    expect(resolvePerpsHeaderAccountLabel(null, 'Contact alias')).toBeNull();
  });
});
