import { getLinkedScrollSettlement } from '@rabby-wallet/rn-collapsible-scene-view/src/linkedScrollLifecycle';

describe('linked native horizontal settlement authority', () => {
  it.each([0, 1, 2, 3])('accepts the aligned resting leaf %s', index => {
    expect(getLinkedScrollSettlement(index, 4, false)).toBe(index);
  });

  it.each([0, 1.4, 2, 3])(
    'ignores an old animator ending during a new drag at %s',
    progress => {
      expect(getLinkedScrollSettlement(progress, 4, true)).toBeNull();
    },
  );

  it.each([-1, 0.4, 1.6, 4, Number.NaN, Infinity])(
    'does not round invalid or interrupted native progress %s',
    progress => {
      expect(getLinkedScrollSettlement(progress, 4, false)).toBeNull();
    },
  );

  it('tolerates only native floating-point noise, not meaningful displacement', () => {
    expect(getLinkedScrollSettlement(1.00001, 4, false)).toBe(1);
    expect(getLinkedScrollSettlement(1.01, 4, false)).toBeNull();
    expect(getLinkedScrollSettlement(0, 0, false)).toBeNull();
  });
});
