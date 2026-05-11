import {
  normalizeMiniSignGasState,
  resolveMiniSignSubmitGasMode,
} from './gasPaymentState';

describe('MiniSignV2 gas payment state', () => {
  it('preserves a manual native gas selection when gas account is available', () => {
    const state = {
      gasMethod: 'native' as const,
      useGasless: false,
      noCustomRPC: true,
      isGasNotEnough: true,
      gasless: null,
      gasAccount: {
        chain_not_support: false,
      },
    };

    expect(normalizeMiniSignGasState(state)).toBe(state);
  });

  it('keeps manual gas account selection and disables gasless for submission', () => {
    const normalized = normalizeMiniSignGasState({
      gasMethod: 'gasAccount' as const,
      useGasless: true,
      noCustomRPC: true,
      isGasNotEnough: true,
      gasless: {
        is_gasless: true,
      },
      gasAccount: {
        chain_not_support: false,
      },
    });

    expect(normalized.gasMethod).toBe('gasAccount');
    expect(normalized.useGasless).toBe(false);
  });

  it('resolves submit mode from the selected gas method', () => {
    expect(
      resolveMiniSignSubmitGasMode({
        gasMethod: 'native',
        useGasless: false,
      }),
    ).toBe('native');
    expect(
      resolveMiniSignSubmitGasMode({
        gasMethod: 'native',
        useGasless: true,
      }),
    ).toBe('gasless');
    expect(
      resolveMiniSignSubmitGasMode({
        gasMethod: 'gasAccount',
        useGasless: true,
      }),
    ).toBe('gasAccount');
  });
});
