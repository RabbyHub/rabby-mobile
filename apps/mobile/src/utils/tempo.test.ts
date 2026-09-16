import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  buildTempoTransaction,
  shouldUseTempoTransaction,
  toTempoCallsTx,
} from './tempo';

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

describe('toTempoCallsTx', () => {
  const topLevelTransfer = {
    type: '0x76',
    to: '0x0000000000000000000000000000000000000020',
    data: '0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead',
    value: '0xde0b6b3a7640000',
  };

  it('hydrates an explicit empty call from top-level fields', () => {
    const result = toTempoCallsTx({
      ...topLevelTransfer,
      calls: [{}],
    });

    expect(result.calls).toStrictEqual([
      {
        to: topLevelTransfer.to,
        data: topLevelTransfer.data,
        value: topLevelTransfer.value,
      },
    ]);
  });

  it('uses top-level fields when calls is empty', () => {
    const result = toTempoCallsTx({
      ...topLevelTransfer,
      calls: [],
    });

    expect(result.calls).toEqual([
      {
        to: topLevelTransfer.to,
        data: topLevelTransfer.data,
        value: topLevelTransfer.value,
      },
    ]);
  });

  it('wraps top-level fields when calls is absent', () => {
    const result = toTempoCallsTx(topLevelTransfer);

    expect(result.calls).toEqual([
      {
        to: topLevelTransfer.to,
        data: topLevelTransfer.data,
        value: topLevelTransfer.value,
      },
    ]);
  });

  it('builds the same hydrated transfer used by the signing path', () => {
    const result = buildTempoTransaction(
      {
        ...topLevelTransfer,
        calls: [{}],
      },
      { stripTopLevelData: true },
    );

    expect(result).toMatchObject({
      type: '0x76',
      calls: [
        {
          to: topLevelTransfer.to,
          data: topLevelTransfer.data,
          value: topLevelTransfer.value,
        },
      ],
    });
    expect(result).not.toHaveProperty('to');
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('value');
  });
});
