import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import {
  applyCustomNetworkGas,
  getCustomNetworkEffectiveGasPrice,
  getCustomNetworkGasCost,
  hasValidCustomNetworkGasFields,
  parseRequestFee,
  resolveCustomGasPriorityFee,
} from './gas';

const GWEI = 1_000_000_000;

const tx = {
  chainId: 31337,
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  data: '0x',
  value: '0x0',
  nonce: '0x0',
  gas: '0x5208',
  gasPrice: '0x1',
} as Tx;

describe('applyCustomNetworkGas', () => {
  it('writes type-2 fee fields and drops gasPrice', () => {
    const next = applyCustomNetworkGas({
      tx,
      gas: { price: 16 * GWEI, priority_price: GWEI },
      support1559: true,
    });

    expect(next.gasPrice).toBeUndefined();
    expect(next.maxFeePerGas).toBe(`0x${(16 * GWEI).toString(16)}`);
    expect(next.maxPriorityFeePerGas).toBe(`0x${GWEI.toString(16)}`);
  });

  it('caps the tip at the max fee', () => {
    const next = applyCustomNetworkGas({
      tx,
      gas: { price: GWEI, priority_price: 2 * GWEI },
      support1559: true,
    });

    expect(next.maxPriorityFeePerGas).toBe(next.maxFeePerGas);
  });

  it('uses the full price as tip when the level has none', () => {
    const next = applyCustomNetworkGas({
      tx,
      gas: { price: 3 * GWEI, priority_price: null },
      support1559: true,
    });

    expect(next.maxPriorityFeePerGas).toBe(next.maxFeePerGas);
  });

  it('writes only gasPrice for a legacy tx', () => {
    const next = applyCustomNetworkGas({
      tx: { ...tx, maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1' },
      gas: { price: 9.6 * GWEI, priority_price: GWEI },
      support1559: false,
    });

    expect(next.gasPrice).toBe(`0x${(9.6 * GWEI).toString(16)}`);
    expect(next.maxFeePerGas).toBeUndefined();
    expect(next.maxPriorityFeePerGas).toBeUndefined();
  });
});

describe('resolveCustomGasPriorityFee', () => {
  it('keeps the tip of a request', () => {
    expect(
      resolveCustomGasPriorityFee({
        price: 5 * GWEI,
        fromRequest: true,
        requestPriorityFee: 2 * GWEI,
        cachedPriorityFee: 3 * GWEI,
        marketPriorityFee: GWEI,
      }),
    ).toBe(2 * GWEI);
  });

  it('prices a gasPrice-only request in full', () => {
    expect(
      resolveCustomGasPriorityFee({
        price: 5 * GWEI,
        fromRequest: true,
        marketPriorityFee: GWEI,
      }),
    ).toBe(5 * GWEI);
  });

  it('uses the cached tip for a cached price, then the market tip', () => {
    expect(
      resolveCustomGasPriorityFee({
        price: 5 * GWEI,
        fromRequest: false,
        cachedPriorityFee: 3 * GWEI,
        marketPriorityFee: GWEI,
      }),
    ).toBe(3 * GWEI);
    expect(
      resolveCustomGasPriorityFee({
        price: 5 * GWEI,
        fromRequest: false,
        cachedPriorityFee: null,
        marketPriorityFee: GWEI,
      }),
    ).toBe(GWEI);
  });

  it('never exceeds the price', () => {
    expect(
      resolveCustomGasPriorityFee({
        price: GWEI,
        fromRequest: false,
        cachedPriorityFee: 3 * GWEI,
      }),
    ).toBe(GWEI);
  });
});

describe('custom network gas cost', () => {
  const level = { price: 16 * GWEI, priority_price: GWEI, base_fee: 10 * GWEI };

  it('charges base fee plus tip on an EIP-1559 network', () => {
    expect(getCustomNetworkEffectiveGasPrice(level, true)).toBe(11 * GWEI);
    expect(
      getCustomNetworkGasCost({
        gas: level,
        gasUsed: 21000,
        support1559: true,
      }).toString(),
    ).toBe('0.000231');
  });

  it('charges at most the max fee', () => {
    expect(
      getCustomNetworkEffectiveGasPrice(
        { price: 10.5 * GWEI, priority_price: GWEI, base_fee: 10 * GWEI },
        true,
      ),
    ).toBe(10.5 * GWEI);
  });

  it('charges the full price for a legacy tx or an unknown base fee', () => {
    expect(getCustomNetworkEffectiveGasPrice(level, false)).toBe(16 * GWEI);
    expect(
      getCustomNetworkEffectiveGasPrice(
        { price: 16 * GWEI, priority_price: GWEI },
        true,
      ),
    ).toBe(16 * GWEI);
  });
});

describe('hasValidCustomNetworkGasFields', () => {
  it('accepts exactly one complete set of fee fields', () => {
    expect(
      hasValidCustomNetworkGasFields(
        { maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1' },
        true,
      ),
    ).toBe(true);
    expect(hasValidCustomNetworkGasFields({ gasPrice: '0x2' }, false)).toBe(
      true,
    );
  });

  it.each([
    ['legacy fields on a type-2 tx', { gasPrice: '0x2' }, true],
    [
      'both sets on a type-2 tx',
      { gasPrice: '0x2', maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1' },
      true,
    ],
    [
      'a tip above the max fee',
      { maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x2' },
      true,
    ],
    ['a missing tip', { maxFeePerGas: '0x2' }, true],
    [
      'type-2 fields on a legacy tx',
      { maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1' },
      false,
    ],
    ['a non-hex gas price', { gasPrice: '2' }, false],
  ])('rejects %s', (_name, fields, support1559) => {
    expect(hasValidCustomNetworkGasFields(fields as Tx, support1559)).toBe(
      false,
    );
  });
});

describe('parseRequestFee', () => {
  it('parses hex and decimal fees', () => {
    expect(parseRequestFee('0x3b9aca00')).toBe(GWEI);
    expect(parseRequestFee(String(GWEI))).toBe(GWEI);
    expect(parseRequestFee(GWEI)).toBe(GWEI);
  });

  it('ignores a missing or invalid fee', () => {
    expect(parseRequestFee(undefined)).toBeUndefined();
    expect(parseRequestFee('')).toBeUndefined();
    expect(parseRequestFee('not a fee')).toBeUndefined();
    expect(parseRequestFee(-1)).toBeUndefined();
  });
});
