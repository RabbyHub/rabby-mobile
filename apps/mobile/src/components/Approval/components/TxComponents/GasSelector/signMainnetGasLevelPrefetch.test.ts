import {
  resolveSignMainnetAutoDowngradeGasLevel,
  type SignMainnetGasLevelState,
} from './signMainnetGasLevelPrefetch';

const fingerprint = 'tx-1';

const state = (
  patch: SignMainnetGasLevelState['slow'],
): NonNullable<SignMainnetGasLevelState['slow']> => ({
  fingerprint,
  nativeUsd: '$0.01',
  loading: false,
  ...patch,
});

describe('resolveSignMainnetAutoDowngradeGasLevel', () => {
  it('uses gas account at the selected level when it can pay', () => {
    expect(
      resolveSignMainnetAutoDowngradeGasLevel({
        selectedSupportedLevel: 'fast',
        gasAccountChainSupported: true,
        requestFingerprint: fingerprint,
        levelState: {
          fast: state({
            nativeNotEnough: true,
            gasAccount: [false, '$0.01'],
          }),
        },
      }),
    ).toEqual({ level: 'fast', gasMethod: 'gasAccount' });
  });

  it('downgrades to native lower level before gas account fallback', () => {
    expect(
      resolveSignMainnetAutoDowngradeGasLevel({
        selectedSupportedLevel: 'fast',
        gasAccountChainSupported: true,
        requestFingerprint: fingerprint,
        levelState: {
          fast: state({
            nativeNotEnough: true,
            gasAccount: [true, '$0.03'],
          }),
          normal: state({
            nativeNotEnough: true,
            gasAccount: [true, '$0.02'],
          }),
          slow: state({
            nativeNotEnough: false,
            gasAccount: [true, '$0.01'],
          }),
        },
      }),
    ).toEqual({ level: 'slow', gasMethod: 'native' });
  });

  it('downgrades custom gas to the first lower supported level', () => {
    expect(
      resolveSignMainnetAutoDowngradeGasLevel({
        selectedGasPrice: 40,
        supportedGasLevels: [
          { level: 'slow', price: 10 },
          { level: 'normal', price: 30 },
          { level: 'fast', price: 50 },
        ],
        gasAccountChainSupported: true,
        requestFingerprint: fingerprint,
        levelState: {
          normal: state({
            nativeNotEnough: false,
            gasAccount: [true, '$0.02'],
          }),
        },
      }),
    ).toEqual({ level: 'normal', gasMethod: 'native' });
  });

  it('does not switch when the gas account result says the chain is unsupported', () => {
    expect(
      resolveSignMainnetAutoDowngradeGasLevel({
        selectedSupportedLevel: 'fast',
        gasAccountChainSupported: true,
        requestFingerprint: fingerprint,
        levelState: {
          fast: state({
            nativeNotEnough: true,
            gasAccount: [true, '$0.03'],
            gasAccountResult: {
              chain_not_support: true,
            },
          }),
          normal: state({
            nativeNotEnough: true,
            gasAccount: [true, '$0.02'],
            gasAccountResult: {
              chain_not_support: true,
            },
          }),
        },
      }),
    ).toBeNull();
  });
});
