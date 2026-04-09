import BigNumber from 'bignumber.js';

import { createAmountComparer, FormValuesOnSubmit } from './form';

describe('FormValuesOnSubmit', () => {
  it('reports no_snapshot when compare runs before save', () => {
    const form = new FormValuesOnSubmit<{ amount: string }>();

    expect(form.compare({ amount: '1' })).toEqual({
      isChanged: true,
      changedFields: ['no_snapshot'],
      oldValues: {},
      newValues: { amount: '1' },
    });
  });

  it('tracks snapshot lifecycle and ignores configured fields', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123);
    const form = new FormValuesOnSubmit<{
      amount: string;
      memo: string;
      ignored: string;
    }>({
      ignoreFields: ['ignored'],
    });

    form.save({
      amount: '1.00',
      memo: 'hello',
      ignored: 'old',
    });

    expect(form.hasSnapshot()).toBe(true);
    expect(form.getTimestamp()).toBe(123);
    expect(form.getSnapshot()).toEqual({
      amount: '1.00',
      memo: 'hello',
      ignored: 'old',
    });

    expect(
      form.compare({
        amount: '1',
        memo: 'changed',
        ignored: 'new',
      }),
    ).toEqual({
      isChanged: true,
      changedFields: ['memo'],
      oldValues: { memo: 'hello' },
      newValues: { memo: 'changed' },
    });

    form.clear();
    expect(form.hasSnapshot()).toBe(false);
    expect(form.getTimestamp()).toBe(0);
    expect(form.getSnapshot()).toBeNull();

    nowSpy.mockRestore();
  });

  it('uses BigNumber-aware default comparisons and custom comparers', () => {
    const form = new FormValuesOnSubmit<{
      bn: BigNumber;
      amount: string;
      note: string;
    }>({
      comparers: {
        note: (oldValue, newValue) => oldValue?.trim() !== newValue?.trim(),
      },
    });

    form.save({
      bn: new BigNumber('1'),
      amount: '1.000',
      note: 'hello',
    });

    expect(
      form.compare({
        bn: new BigNumber('1.0'),
        amount: '1',
        note: ' hello ',
      }),
    ).toEqual({
      isChanged: false,
      changedFields: [],
      oldValues: {},
      newValues: {},
    });
  });
});

describe('createAmountComparer', () => {
  it('treats empty values as zero and reports changes when amounts differ', () => {
    const comparer = createAmountComparer<string>();

    expect(comparer('', undefined as any)).toBe(false);
    expect(comparer('1.00', '1')).toBe(false);
    expect(comparer('1.00', '2')).toBe(true);
  });
});
