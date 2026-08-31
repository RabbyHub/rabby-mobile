import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { shouldUseTempoTransaction } from './tempo';

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: jest.fn(),
}));
jest.mock('@/core/request', () => ({
  openapi: {},
}));

describe('shouldUseTempoTransaction', () => {
  const tempoBatch = {
    type: '0x76',
    calls: [
      {
        to: '0x20C0000000000000000000000000000000000000',
        data: '0x',
        value: '0x0',
      },
    ],
  };

  it('recognizes an explicit Tempo transaction independently of keyring support', () => {
    expect(
      shouldUseTempoTransaction({
        tx: tempoBatch,
        chainServerId: 'tempo',
        isGasAccount: true,
        accountType: KEYRING_TYPE.GnosisKeyring,
      }),
    ).toBe(true);
  });

  it('does not treat Tempo fields as special on another chain', () => {
    expect(
      shouldUseTempoTransaction({
        tx: tempoBatch,
        chainServerId: 'eth',
        accountType: KEYRING_TYPE.SimpleKeyring,
      }),
    ).toBe(false);
  });

  it('keeps gas-account generated Tempo transactions limited to supported keyrings', () => {
    expect(
      shouldUseTempoTransaction({
        tx: {},
        chainServerId: 'tempo',
        isGasAccount: true,
        accountType: KEYRING_TYPE.SimpleKeyring,
      }),
    ).toBe(true);
    expect(
      shouldUseTempoTransaction({
        tx: {},
        chainServerId: 'tempo',
        isGasAccount: true,
        accountType: KEYRING_TYPE.GnosisKeyring,
      }),
    ).toBe(false);
  });
});
