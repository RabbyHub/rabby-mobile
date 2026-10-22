import { classifySignError } from './signErrors';

const codes = {
  GAS_NOT_ENOUGH: 'Gas not enough',
  CANT_PROCESS: 'Can not process',
  PREFETCH_FAILURE: 'prepare failure',
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

  it('falls back to failed', () => {
    expect(classifySignError('User cancelled', codes)).toBe('failed');
    expect(classifySignError(undefined, codes)).toBe('failed');
  });
});
