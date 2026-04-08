import {
  FormValuesOnSubmit,
  createAmountComparer,
  shouldIgnoreAmountChangeInMaxMode,
} from './form';

type Snapshot = {
  amount: string;
  amountMode: 'exact' | 'max';
};

describe('form submit guards', () => {
  it('ignores amount drift when both sides are max mode', () => {
    const formValues = new FormValuesOnSubmit<Snapshot>({
      comparers: {
        amount: createAmountComparer(),
      },
    });

    formValues.save({
      amount: '1.2345',
      amountMode: 'max',
    });

    const comparison = formValues.compare({
      amount: '1.2333',
      amountMode: 'max',
    });

    expect(comparison.isChanged).toBe(true);
    expect(
      shouldIgnoreAmountChangeInMaxMode(
        comparison,
        {
          amount: '1.2345',
          amountMode: 'max',
        },
        {
          amount: '1.2333',
          amountMode: 'max',
        },
      ),
    ).toBe(true);
  });

  it('does not ignore amount changes in exact mode', () => {
    const formValues = new FormValuesOnSubmit<Snapshot>({
      comparers: {
        amount: createAmountComparer(),
      },
    });

    formValues.save({
      amount: '1.2345',
      amountMode: 'exact',
    });

    const comparison = formValues.compare({
      amount: '1.2333',
      amountMode: 'exact',
    });

    expect(comparison.isChanged).toBe(true);
    expect(
      shouldIgnoreAmountChangeInMaxMode(
        comparison,
        {
          amount: '1.2345',
          amountMode: 'exact',
        },
        {
          amount: '1.2333',
          amountMode: 'exact',
        },
      ),
    ).toBe(false);
  });
});
