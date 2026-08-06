import { resolveStoredGasSelection } from './gasSelection';

describe('resolveStoredGasSelection', () => {
  it('ignores stored custom gas for a flow that requires normal gas', () => {
    expect(
      resolveStoredGasSelection({
        gasLevel: 'custom',
        gasPrice: 10,
        fixedGasPrice: 20,
        ignoreStoredSelection: true,
      }),
    ).toEqual({
      lastTimeSelect: 'gasLevel',
      gasLevel: 'normal',
    });
  });

  it('prefers fixed gas for regular signing flows', () => {
    expect(
      resolveStoredGasSelection({
        gasLevel: 'fast',
        gasPrice: 10,
        fixedGasPrice: 20,
      }),
    ).toEqual({
      lastTimeSelect: 'gasPrice',
      gasLevel: 'custom',
      gasPrice: 20,
    });
  });

  it('treats a zero fixed gas price as stored fixed mode', () => {
    expect(
      resolveStoredGasSelection({
        gasLevel: 'fast',
        gasPrice: 10,
        fixedGasPrice: 0,
      }),
    ).toEqual({
      lastTimeSelect: 'gasPrice',
      gasLevel: 'custom',
      gasPrice: 0,
    });
  });
});
