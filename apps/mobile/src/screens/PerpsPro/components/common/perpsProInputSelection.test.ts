import { resolvePerpsProEmptyInputSelection } from './perpsProInputSelection';

describe('resolvePerpsProEmptyInputSelection', () => {
  it('leaves an empty iOS input selection under native ownership', () => {
    expect(resolvePerpsProEmptyInputSelection('ios')).toBeUndefined();
  });

  it('preserves the existing Android empty selection anchor', () => {
    expect(resolvePerpsProEmptyInputSelection('android')).toEqual({
      end: 0,
      start: 0,
    });
  });
});
