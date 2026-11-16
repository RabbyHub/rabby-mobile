import { classifySignError } from './signErrors';

const codes = {
  GAS_NOT_ENOUGH: 'Gas not enough',
  CANT_PROCESS: 'Can not process',
  PREFETCH_FAILURE: 'prepare failure',
  GAS_FEE_TOO_HIGH: 'selectedGasCost too high',
};

describe('classifySignError', () => {
  it('maps gas problems from strings', () => {
    expect(classifySignError('Gas not enough', codes)).toBe('gasNotEnough');
    expect(classifySignError('Can not process', codes)).toBe('gasNotEnough');
  });

  it('maps prefetch failure from both a string and an Error', () => {
    expect(classifySignError('prepare failure', codes)).toBe(
      'simulationFailed',
    );
    expect(classifySignError(new Error('prepare failure'), codes)).toBe(
      'simulationFailed',
    );
  });

  it('maps gas fee over the MiniSign limit', () => {
    expect(classifySignError('selectedGasCost too high', codes)).toBe(
      'gasTooHigh',
    );
    expect(
      classifySignError(new Error('selectedGasCost too high'), codes),
    ).toBe('gasTooHigh');
  });

  it('falls back to failed', () => {
    expect(classifySignError('User cancelled', codes)).toBe('failed');
    expect(classifySignError(undefined, codes)).toBe('failed');
  });
});
