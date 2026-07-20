import { applyPerpsStateUpdate } from './perpsStateUpdate';

describe('applyPerpsStateUpdate', () => {
  const list = [{ id: 1 }];
  const previous = {
    loading: false,
    list,
  };

  it('reuses the previous state when top-level values are unchanged', () => {
    const result = applyPerpsStateUpdate(previous, prev => ({
      ...prev,
      loading: false,
    }));

    expect(result).toBe(previous);
  });

  it('publishes a state with a changed top-level value', () => {
    const result = applyPerpsStateUpdate(previous, prev => ({
      ...prev,
      loading: true,
    }));

    expect(result).not.toBe(previous);
    expect(result.loading).toBe(true);
  });

  it('treats a new nested reference as an explicit update', () => {
    const result = applyPerpsStateUpdate(previous, prev => ({
      ...prev,
      list: [...prev.list],
    }));

    expect(result).not.toBe(previous);
    expect(result.list).toEqual(previous.list);
  });
});
