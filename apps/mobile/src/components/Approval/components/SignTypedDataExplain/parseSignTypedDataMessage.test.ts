import {
  filterPrimaryType,
  parseSignTypedDataMessage,
} from './parseSignTypedDataMessage';

describe('parseSignTypedDataMessage', () => {
  it('returns message directly when the payload has no primary type', () => {
    expect(
      parseSignTypedDataMessage({
        message: {
          raw: 'hello',
        },
      }),
    ).toEqual({ raw: 'hello' });
  });

  it('parses string payloads and keeps only primary type fields', () => {
    expect(
      parseSignTypedDataMessage(
        JSON.stringify({
          primaryType: 'Permit',
          types: {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
          },
          message: {
            owner: '0x00000000000000000000000000000000000000aa',
            spender: '0x00000000000000000000000000000000000000bb',
            value: '100',
          },
        }),
      ),
    ).toEqual({
      owner: '0x00000000000000000000000000000000000000aa',
      spender: '0x00000000000000000000000000000000000000bb',
    });
  });
});

describe('filterPrimaryType', () => {
  it('preserves the declared field order and drops undeclared fields', () => {
    expect(
      Object.keys(
        filterPrimaryType({
          primaryType: 'Order',
          types: {
            Order: [
              { name: 'maker', type: 'address' },
              { name: 'amount', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          message: {
            amount: '10',
            ignored: 'drop',
            deadline: '99',
            maker: '0x00000000000000000000000000000000000000aa',
          },
        }),
      ),
    ).toEqual(['maker', 'amount', 'deadline']);
  });
});
