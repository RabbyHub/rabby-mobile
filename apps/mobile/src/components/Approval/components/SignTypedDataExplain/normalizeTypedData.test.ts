import { normalizeTypedData } from './parseSignTypedDataMessage';

describe('normalizeTypedData', () => {
  it('removes fields not declared by the EIP-712 types', () => {
    const typedData = {
      primaryType: 'Mail',
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'contents', type: 'string' },
        ],
      },
      domain: {
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000001',
        extraDomainField: 'hidden',
      },
      message: {
        from: '0x0000000000000000000000000000000000000002',
        amount: '2',
        extraMessageField: 'hidden',
      },
      extraTopLevelField: 'hidden',
    };

    const normalized = normalizeTypedData(typedData);

    expect(normalized).toEqual({
      primaryType: 'Mail',
      types: typedData.types,
      domain: {
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000001',
      },
      message: {
        from: '0x0000000000000000000000000000000000000002',
        amount: '2',
      },
    });
    expect(normalized.message).not.toHaveProperty('contents');
    expect(typedData.domain).toHaveProperty('extraDomainField', 'hidden');
    expect(typedData.message).toHaveProperty('extraMessageField', 'hidden');
    expect(typedData).toHaveProperty('extraTopLevelField', 'hidden');
  });

  it('returns data without a complete EIP-712 envelope unchanged', () => {
    const data = {
      primaryType: 'Mail',
      types: {},
      message: { contents: 'hello' },
    };

    expect(normalizeTypedData(data as never)).toBe(data);
  });
});
