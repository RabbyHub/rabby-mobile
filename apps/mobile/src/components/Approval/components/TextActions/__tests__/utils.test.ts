import { getActionTypeText } from '../utils';

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key: string) => `t:${key}`),
  },
}));

describe('Approval TextActions utils', () => {
  it('maps typed-data create-key and verify-address actions to i18n keys', () => {
    expect(getActionTypeText({ createKey: {} } as any)).toBe(
      't:page.signTypedData.createKey.title',
    );
    expect(getActionTypeText({ verifyAddress: {} } as any)).toBe(
      't:page.signTypedData.verifyAddress.title',
    );
  });

  it('uses the common title when no earlier typed-data branch matches', () => {
    expect(
      getActionTypeText({ common: { title: 'Typed common' } } as any),
    ).toBe('Typed common');
  });

  it('falls back to unknown action for null or unknown typed-data actions', () => {
    expect(getActionTypeText(null)).toBe('t:page.signTx.unknownAction');
    expect(getActionTypeText({} as any)).toBe('t:page.signTx.unknownAction');
  });

  it('keeps typed-data branch priority before common titles', () => {
    expect(
      getActionTypeText({
        createKey: {},
        common: { title: 'Typed common' },
      } as any),
    ).toBe('t:page.signTypedData.createKey.title');
  });
});
