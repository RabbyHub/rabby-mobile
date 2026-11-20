import {
  buildPerpsProScalePlan,
  getPerpsProScaleBarWidth,
  validatePerpsProScaleCapacity,
} from './scaleOrder';

const input = {
  lowerPrice: '1000',
  upperPrice: '1400',
  size: '1',
  count: '5',
  distribution: 'ascending' as const,
  side: 'buy' as const,
  szDecimals: 2,
};
const facts = {
  availableQuote: '1000',
  leverage: 10,
  markPrice: '1200',
  maxTradeSize: '10',
  positionSize: '0',
};

describe('Scale order quantities and aggregate capacity', () => {
  it('floors each child without adding the remainder, and reverses complete sell pairs', () => {
    const plan = buildPerpsProScalePlan(input);
    expect(plan.orders).toEqual([
      { price: '1000', size: '0.06' },
      { price: '1100', size: '0.13' },
      { price: '1200', size: '0.2' },
      { price: '1300', size: '0.26' },
      { price: '1400', size: '0.33' },
    ]);
    expect(plan.totalSize).toBe('0.98');
    expect(plan.notional).toBe('1243');
    expect(buildPerpsProScalePlan({ ...input, side: 'sell' }).orders).toEqual(
      [...plan.orders].reverse(),
    );
    expect(
      buildPerpsProScalePlan({
        ...input,
        distribution: 'descending',
      }).orders.map(leg => leg.size),
    ).toEqual(['0.33', '0.26', '0.2', '0.13', '0.06']);
    const flat = buildPerpsProScalePlan({ ...input, distribution: 'flat' });
    expect(flat.orders.map(leg => leg.size)).toEqual([
      '0.2',
      '0.2',
      '0.2',
      '0.2',
      '0.2',
    ]);
    expect(getPerpsProScaleBarWidth('0.2', '0.2', 'flat')).toBe(50);
    expect(getPerpsProScaleBarWidth('0.33', '0.33', 'ascending')).toBe(70);
  });
  it.each(['1', '101', '5.5', '', '1e2'])('rejects invalid count %s', count => {
    expect(() => buildPerpsProScalePlan({ ...input, count })).toThrow('count');
  });
  it('keeps nearest-price rounding, integer exemptions and rejects collapsed prices or small children', () => {
    expect(
      buildPerpsProScalePlan({
        ...input,
        lowerPrice: '12345',
        upperPrice: '12348',
        count: '3',
      }).orders[1].price,
    ).toBe('12347');
    expect(() =>
      buildPerpsProScalePlan({
        ...input,
        lowerPrice: '12345',
        upperPrice: '12346',
        count: '5',
      }),
    ).toThrow('duplicatePrice');
    expect(() => buildPerpsProScalePlan({ ...input, size: '0.01' })).toThrow(
      'minimum',
    );
    expect(
      buildPerpsProScalePlan({ ...input, size: '100', count: '100' }).orders,
    ).toHaveLength(100);
  });
  it('uses total weighted server capacity, while cost deducts the closable position once', () => {
    const plan = buildPerpsProScalePlan(input);
    expect(
      validatePerpsProScaleCapacity({
        plan,
        facts,
        reduceOnly: false,
        side: 'buy',
      }),
    ).toBe('124.3');
    expect(
      validatePerpsProScaleCapacity({
        plan,
        facts: { ...facts, positionSize: '-0.98' },
        reduceOnly: false,
        side: 'buy',
      }),
    ).toBe('0');
    expect(() =>
      validatePerpsProScaleCapacity({
        plan,
        facts: { ...facts, maxTradeSize: '0.9', positionSize: '-0.98' },
        reduceOnly: false,
        side: 'buy',
      }),
    ).toThrow('capacity');
    expect(() =>
      validatePerpsProScaleCapacity({
        plan,
        facts: { ...facts, positionSize: '-0.5' },
        reduceOnly: true,
        side: 'buy',
      }),
    ).toThrow('reduceOnly');
    expect(() =>
      validatePerpsProScaleCapacity({
        plan,
        facts: { ...facts, availableQuote: '100' },
        reduceOnly: false,
        side: 'buy',
      }),
    ).toThrow('capacity');
    expect(() =>
      validatePerpsProScaleCapacity({
        plan,
        facts: { ...facts, maxUsdValueSize: '1200' },
        reduceOnly: false,
        side: 'buy',
      }),
    ).toThrow('maximum');
  });
});
