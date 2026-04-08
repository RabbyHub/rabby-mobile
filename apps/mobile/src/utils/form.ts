import BigNumber from 'bignumber.js';

export interface FormComparisonResult<T extends Record<string, any>> {
  isChanged: boolean;
  changedFields: (keyof T)[];
  oldValues: Partial<T>;
  newValues: Partial<T>;
}

export type FormFieldComparer<T> = {
  [K in keyof T]?: (oldValue: T[K], newValue: T[K]) => boolean;
};

export type FormAmountMode = 'exact' | 'max';

export interface FormValuesOnSubmitOptions<T extends Record<string, any>> {
  /** Custom comparers for specific fields */
  comparers?: FormFieldComparer<T>;
  /** Fields to ignore during comparison */
  ignoreFields?: (keyof T)[];
}

export class FormValuesOnSubmit<T extends Record<string, any>> {
  private snapshot: T | null = null;
  private timestamp: number = 0;
  private options: FormValuesOnSubmitOptions<T>;

  constructor(options: FormValuesOnSubmitOptions<T> = {}) {
    this.options = options;
  }

  /**
   * Save form values snapshot before authentication
   */
  save(values: T): void {
    this.snapshot = { ...values };
    this.timestamp = Date.now();
  }

  /**
   * Compare current form values with saved snapshot
   * Returns comparison result indicating if any critical field has changed
   */
  compare(currentValues: T): FormComparisonResult<T> {
    if (!this.snapshot) {
      return {
        isChanged: true,
        changedFields: ['no_snapshot' as keyof T],
        oldValues: {},
        newValues: currentValues,
      };
    }

    const changedFields: (keyof T)[] = [];
    const oldValues: Partial<T> = {};
    const newValues: Partial<T> = {};

    const allKeys = new Set<keyof T>([
      ...Object.keys(this.snapshot),
      ...Object.keys(currentValues),
    ] as (keyof T)[]);

    for (const key of allKeys) {
      // Skip ignored fields
      if (this.options.ignoreFields?.includes(key)) {
        continue;
      }

      const oldValue = this.snapshot[key];
      const newValue = currentValues[key];

      // Use custom comparer if provided
      const comparer = this.options.comparers?.[key];
      const isDifferent = comparer
        ? comparer(oldValue, newValue)
        : !this.defaultCompare(oldValue, newValue);

      if (isDifferent) {
        changedFields.push(key);
        oldValues[key] = oldValue;
        newValues[key] = newValue;
      }
    }

    return {
      isChanged: changedFields.length > 0,
      changedFields,
      oldValues,
      newValues,
    };
  }

  /**
   * Default comparison logic for values
   */
  private defaultCompare(a: any, b: any): boolean {
    // Handle BigNumber comparison
    if (a instanceof BigNumber && b instanceof BigNumber) {
      return a.eq(b);
    }
    // Handle string number comparison (for amount fields)
    if (typeof a === 'string' && typeof b === 'string') {
      // Try to compare as numbers if both look like numbers
      const aNum = new BigNumber(a);
      const bNum = new BigNumber(b);
      if (!aNum.isNaN() && !bNum.isNaN()) {
        return aNum.eq(bNum);
      }
    }
    // Standard equality check
    return a === b;
  }

  /**
   * Get the saved snapshot
   */
  getSnapshot(): T | null {
    return this.snapshot;
  }

  /**
   * Get the timestamp when snapshot was saved
   */
  getTimestamp(): number {
    return this.timestamp;
  }

  /**
   * Clear the saved snapshot
   */
  clear(): void {
    this.snapshot = null;
    this.timestamp = 0;
  }

  /**
   * Check if a snapshot exists
   */
  hasSnapshot(): boolean {
    return this.snapshot !== null;
  }
}

/**
 * Helper to create a BigNumber comparer for amount fields
 */
export function createAmountComparer<T>(): (
  oldValue: T,
  newValue: T,
) => boolean {
  return (oldValue: any, newValue: any) => {
    const oldAmount = new BigNumber(oldValue || '0');
    const newAmount = new BigNumber(newValue || '0');
    return !oldAmount.eq(newAmount);
  };
}

export function shouldIgnoreAmountChangeInMaxMode<
  T extends {
    amount?: string;
    amountMode?: FormAmountMode;
  },
>(comparison: FormComparisonResult<T>, snapshot: T, currentValues: T): boolean {
  if (!comparison.isChanged) {
    return false;
  }

  if (
    comparison.changedFields.length !== 1 ||
    comparison.changedFields[0] !== ('amount' as keyof T)
  ) {
    return false;
  }

  return snapshot.amountMode === 'max' && currentValues.amountMode === 'max';
}
