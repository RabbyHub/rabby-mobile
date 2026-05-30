import { normalizeTypeData } from './utils';

const addr = (suffix: string) =>
  `0x00000000000000000000000000000000000000${suffix}`;

describe('normalizeTypeData', () => {
  it('normalizes EIP-712 domain and primary message values for display', () => {
    const typedData = {
      primaryType: 'Mail',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
          { name: 'salt', type: 'bytes32' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person[]' },
          { name: 'contents', type: 'string' },
          { name: 'count', type: 'uint256' },
          { name: 'enabled', type: 'bool' },
          { name: 'payload', type: 'bytes32' },
        ],
        Person: [
          { name: 'wallet', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'age', type: 'uint8' },
          { name: 'verified', type: 'bool' },
        ],
      },
      domain: {
        name: 'Rabby',
        version: '1',
        chainId: 1,
        verifyingContract: addr('dd'),
        salt: `0x${'11'.repeat(32)}`,
        ignoredDomain: 'drop',
      },
      message: {
        from: {
          wallet: addr('aa'),
          name: 'Alice',
          age: 5,
          verified: true,
          ignoredNested: 'drop',
        },
        to: [
          {
            wallet: addr('bb'),
            name: 'Bob',
            age: '6',
            verified: false,
          },
          {
            wallet: addr('cc'),
            name: 'Carol',
            age: 7,
            verified: true,
          },
        ],
        contents: 'Hello from Hermes',
        count: '42',
        enabled: true,
        payload: `0x${'22'.repeat(32)}`,
        ignoredMessage: 'drop',
      },
    };

    expect(normalizeTypeData(typedData)).toEqual({
      primaryType: 'Mail',
      types: typedData.types,
      domain: {
        name: 'Rabby',
        version: '1',
        chainId: '1',
        verifyingContract: addr('dd'),
        salt: `0x${'11'.repeat(32)}`,
      },
      message: {
        from: {
          wallet: addr('aa'),
          name: 'Alice',
          age: '5',
          verified: true,
        },
        to: [
          {
            wallet: addr('bb'),
            name: 'Bob',
            age: '6',
            verified: false,
          },
          {
            wallet: addr('cc'),
            name: 'Carol',
            age: '7',
            verified: true,
          },
        ],
        contents: 'Hello from Hermes',
        count: '42',
        enabled: true,
        payload: `0x${'22'.repeat(32)}`,
      },
    });
  });

  it('returns the original payload when normalization cannot decode a field', () => {
    const invalidTypedData = {
      primaryType: 'Mail',
      types: {
        EIP712Domain: [],
        Mail: [{ name: 'count', type: 'uint256' }],
      },
      domain: {},
      message: {
        count: 'not-a-number',
      },
    };

    expect(normalizeTypeData(invalidTypedData)).toBe(invalidTypedData);
  });
});
