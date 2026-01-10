import { resolveValFromUpdater } from './store';

describe('utils', () => {
  describe('resolveValFromUpdater(primitive)', () => {
    it('string', () => {
      ['0x1', '0xabc', '0x999'].forEach(value => {
        expect(resolveValFromUpdater(value, value).changed).toBe(false);
        expect(resolveValFromUpdater(value, value + '1').changed).toBe(true);
      });
    });

    it('number', () => {
      [1, 100, 9999].forEach(value => {
        expect(resolveValFromUpdater(value, value).changed).toBe(false);
        expect(resolveValFromUpdater(value, value + 1).changed).toBe(true);
      });
    });
  });

  describe('resolveValFromUpdater(object)', () => {
    it('destructuringObjInput: true; strict: false by default', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const { newVal, changed } = resolveValFromUpdater(prev, prev, {
        destructuringObjInput: true,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual({ ...prev });
    });

    it('destructuringObjInput: false', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const { newVal, changed } = resolveValFromUpdater(prev, prev, {
        destructuringObjInput: false,
      });
      expect(changed).toBe(false);
      expect(newVal).toEqual({ ...prev });
    });

    it('customize compare function', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const input = { a: 1, b: 20, c: 3 };
      const { newVal, changed } = resolveValFromUpdater(prev, input, {
        strict: (prevVal, newVal) => prevVal.b !== newVal.b,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual({ a: 1, b: 20, c: 3 });
    });
  });

  describe('resolveValFromUpdater(array)', () => {
    it('destructuringObjInput: true', () => {
      const prev = [1, 2, 3];
      const { newVal, changed } = resolveValFromUpdater(prev, prev, {
        destructuringObjInput: true,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual([...prev]);
    });

    it('destructuringObjInput: false', () => {
      const prev = [1, 2, 3];
      const { newVal, changed } = resolveValFromUpdater(prev, prev, {
        destructuringObjInput: false,
      });
      expect(changed).toBe(false);
      expect(newVal).toEqual([...prev]);
    });

    it('array replace', () => {
      const prev = [1, 2, 3];
      const input = [1, 2, 3, 4];
      const { newVal, changed } = resolveValFromUpdater(prev, input, {
        destructuringObjInput: true,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual([1, 2, 3, 4]);
    });

    it('[strict] change array replace', () => {
      const prev = [1, 2, 3];
      const input = [1, 2, 3];
      const { newVal, changed } = resolveValFromUpdater(prev, input, {
        strict: true,
      });
      expect(changed).toBe(false);
      expect(newVal).toEqual([1, 2, 3]);
    });

    it('[non-strict] change array replace', () => {
      const prev = [1, 2, 3];
      const input = [1, 2, 3];
      const { newVal, changed } = resolveValFromUpdater(prev, input, {
        strict: false,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual([1, 2, 3]);
    });
  });

  describe('resolveValFromUpdater(function)', () => {
    it('function updater: strict by default', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const updater = (p: typeof prev) => ({
        ...p,
        b: 20,
      });
      const { newVal, changed } = resolveValFromUpdater(prev, updater);
      expect(changed).toBe(true);
      expect(newVal).toEqual({ a: 1, b: 20, c: 3 });
    });

    it('function updater: non-strict', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const updater = (p: typeof prev) => ({
        ...p,
      });
      const { newVal, changed } = resolveValFromUpdater(prev, updater, {
        strict: false,
      });
      expect(changed).toBe(true);
      expect(newVal).toEqual({ a: 1, b: 2, c: 3 });
    });
  });
});
