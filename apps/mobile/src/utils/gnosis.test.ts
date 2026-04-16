const mockRecoverPersonalSignature = jest.fn();
const mockRecoverTypedSignature = jest.fn();
const mockSemverSatisfies = jest.fn();
const mockIsSameAddress = jest.fn((a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
});

function loadGnosisModule() {
  jest.resetModules();

  jest.doMock('eth-sig-util', () => ({
    recoverPersonalSignature: (input: unknown) =>
      mockRecoverPersonalSignature(input),
  }));

  jest.doMock('@metamask/eth-sig-util', () => ({
    recoverTypedSignature: (input: unknown) => mockRecoverTypedSignature(input),
    SignTypedDataVersion: {
      V4: 'V4',
    },
  }));

  jest.doMock('semver/functions/satisfies', () => ({
    __esModule: true,
    default: (version: string, range: string) =>
      mockSemverSatisfies(version, range),
  }));

  jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
    isSameAddress: (a: string, b: string) => mockIsSameAddress(a, b),
  }));

  return require('./gnosis') as typeof import('./gnosis');
}

describe('gnosis utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSemverSatisfies.mockImplementation(version => version >= '1.3.0');
  });

  it('crossCompareOwners keeps addresses matched by isSameAddress', () => {
    const { crossCompareOwners } = loadGnosisModule();

    expect(crossCompareOwners(['0xAbC', '0xdef'], ['0xabc', '0x123'])).toEqual([
      '0xAbC',
    ]);
  });

  it('adjustV lifts eth_signTypedData signatures with low V values', () => {
    const { adjustV } = loadGnosisModule();

    expect(adjustV('eth_signTypedData', `${'a'.repeat(128)}00`)).toBe(
      `${'a'.repeat(128)}1b`,
    );
    expect(adjustV('eth_signTypedData', `${'a'.repeat(128)}1c`)).toBe(
      `${'a'.repeat(128)}1c`,
    );
  });

  it('validateETHSign normalizes personal-sign V values above 30 before recovery', () => {
    mockRecoverPersonalSignature.mockReturnValue('0xowner');
    const { validateETHSign } = loadGnosisModule();

    expect(validateETHSign(`${'b'.repeat(128)}1f`, '0xtxhash', '0xOwner')).toBe(
      true,
    );
    expect(mockRecoverPersonalSignature).toHaveBeenCalledWith({
      data: '0xtxhash',
      sig: `${'b'.repeat(128)}1b`,
    });
  });

  it('validateEOASign builds typed data with or without chainId based on the safe version', () => {
    mockRecoverTypedSignature.mockReturnValue('0xowner');
    const { validateEOASign } = loadGnosisModule();

    expect(
      validateEOASign(
        '0xsig',
        '0xOwner',
        {
          to: '0xto',
          value: '1',
          data: '0x',
          operation: 0,
          safeTxGas: '2',
          baseGas: '3',
          gasPrice: '4',
          gasToken: '0xtoken',
          refundReceiver: '0xrefund',
          nonce: '5',
        },
        '1.3.0',
        '0xsafe',
        1,
      ),
    ).toBe(true);

    expect(mockRecoverTypedSignature).toHaveBeenCalledWith({
      data: expect.objectContaining({
        domain: expect.objectContaining({
          chainId: 1,
          verifyingContract: '0xsafe',
        }),
      }),
      signature: '0xsig',
      version: 'V4',
    });

    mockRecoverTypedSignature.mockClear();
    mockSemverSatisfies.mockReturnValue(false);

    validateEOASign(
      '0xsig',
      '0xOwner',
      {
        to: '0xto',
        value: '1',
        data: '0x',
        operation: 0,
        safeTxGas: '2',
        baseGas: '3',
        gasPrice: '4',
        gasToken: '0xtoken',
        refundReceiver: '0xrefund',
        nonce: '5',
      },
      '1.2.0',
      '0xsafe',
      1,
    );

    expect(mockRecoverTypedSignature).toHaveBeenCalledWith({
      data: expect.objectContaining({
        domain: expect.objectContaining({
          chainId: undefined,
          verifyingContract: '0xsafe',
        }),
      }),
      signature: '0xsig',
      version: 'V4',
    });
  });
});
