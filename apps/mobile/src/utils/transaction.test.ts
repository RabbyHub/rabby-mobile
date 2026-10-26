import { applySelectedGasToTx } from './transactionGas';

const FROM = '0x0000000000000000000000000000000000000001';
const RECIPIENT = '0x000000000000000000000000000000000000dEaD';
const TRANSFER_DATA =
  '0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000002710';

describe('applySelectedGasToTx', () => {
  it('preserves a Tempo batch and all signed Tempo fields on EIP-1559 chains', () => {
    const calls = [
      {
        to: '0x20C0000000000000000000000000000000000000',
        data: TRANSFER_DATA,
        value: '0x0',
      },
      {
        to: '0x20C000000000000000000000b9537d11c60E8b50',
        data: TRANSFER_DATA,
        value: '0x0',
      },
    ];
    const tx = {
      chainId: 4217,
      from: FROM,
      data: '0x',
      gasPrice: '0x1',
      type: '0x76',
      calls,
      feeToken: calls[0].to,
      feePayer: true,
      feePayerSignature: '0x1234',
      nonceKey: '0x2',
      keyAuthorization: '0x5678',
      validBefore: '0x10',
      validAfter: '0x1',
    } as any;

    const result = applySelectedGasToTx({
      tx,
      gasPrice: '0x64',
      support1559: true,
      isTempoTransaction: true,
    }) as any;

    expect(result).toMatchObject({
      chainId: 4217,
      from: FROM,
      data: '0x',
      type: '0x76',
      calls,
      feeToken: calls[0].to,
      feePayer: true,
      feePayerSignature: '0x1234',
      nonceKey: '0x2',
      keyAuthorization: '0x5678',
      validBefore: '0x10',
      validAfter: '0x1',
      maxFeePerGas: '0x64',
      maxPriorityFeePerGas: '0x64',
    });
    expect(result).not.toHaveProperty('gasPrice');
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0].data).toContain(RECIPIENT.slice(2).toLowerCase());
    expect(result.calls[0].data).toMatch(/2710$/);
    expect(tx).toMatchObject({ gasPrice: '0x1', calls });
  });

  it('keeps the existing whitelist conversion for ordinary EIP-1559 transactions', () => {
    const result = applySelectedGasToTx({
      tx: {
        chainId: 1,
        from: FROM,
        to: RECIPIENT,
        data: '0x',
        value: '0x0',
        gasPrice: '0x1',
        type: '0x0',
        customDappField: 'must-not-survive',
      } as any,
      gasPrice: '0x64',
      support1559: true,
    }) as any;

    expect(result).toEqual({
      chainId: 1,
      from: FROM,
      to: RECIPIENT,
      value: '0x0',
      data: '0x',
      gas: undefined,
      maxFeePerGas: '0x64',
      maxPriorityFeePerGas: '0x64',
      nonce: undefined,
    });
  });

  it('keeps legacy fields and updates only gasPrice on non-1559 chains', () => {
    const calls = [{ to: RECIPIENT, data: '0x', value: '0x0' }];
    const result = applySelectedGasToTx({
      tx: {
        chainId: 4217,
        from: FROM,
        calls,
        gasPrice: '0x1',
      } as any,
      gasPrice: '0x64',
      support1559: false,
      isTempoTransaction: true,
    }) as any;

    expect(result).toMatchObject({
      type: '0x76',
      calls,
      gasPrice: '0x64',
    });
    expect(result).not.toHaveProperty('maxFeePerGas');
    expect(result).not.toHaveProperty('maxPriorityFeePerGas');
  });

  it('canonicalizes a calls-only Tempo transaction to type 0x76', () => {
    const calls = [{ to: RECIPIENT, data: '0x', value: '0x0' }];
    const result = applySelectedGasToTx({
      tx: {
        chainId: 4217,
        from: FROM,
        calls,
        gasPrice: '0x1',
      } as any,
      gasPrice: '0x64',
      support1559: true,
      isTempoTransaction: true,
    }) as any;

    expect(result).toMatchObject({
      type: '0x76',
      calls,
      maxFeePerGas: '0x64',
      maxPriorityFeePerGas: '0x64',
    });
  });

  it('keeps authorizationList only when EIP-7702 is enabled', () => {
    const authorizationList = [['0x1', RECIPIENT, '0x0']];
    const tx = {
      chainId: 1,
      from: FROM,
      gasPrice: '0x1',
      authorizationList,
    } as any;

    expect(
      applySelectedGasToTx({
        tx,
        gasPrice: '0x64',
        support1559: true,
        enable7702: true,
      }),
    ).toHaveProperty('authorizationList', authorizationList);
    expect(
      applySelectedGasToTx({
        tx,
        gasPrice: '0x64',
        support1559: true,
        enable7702: false,
      }),
    ).not.toHaveProperty('authorizationList');
  });
});
