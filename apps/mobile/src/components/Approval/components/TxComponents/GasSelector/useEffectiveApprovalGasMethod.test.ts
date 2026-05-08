import { renderHook } from '@testing-library/react-native';

import { useEffectiveApprovalGasMethod } from './useEffectiveApprovalGasMethod';

const baseParams = {
  isReady: true,
  isFirstGasLessLoading: false,
  isGasNotEnough: true,
  gasAccountChainSupported: true,
  noCustomRPC: true,
  canUseGasLess: false,
};

describe('useEffectiveApprovalGasMethod', () => {
  it('auto-selects gas account once but does not override a later manual native selection', () => {
    const setGasMethod = jest.fn();
    const { rerender } = renderHook(
      props => useEffectiveApprovalGasMethod(props),
      {
        initialProps: {
          ...baseParams,
          gasMethod: 'native' as const,
          setGasMethod,
        },
      },
    );

    expect(setGasMethod).toHaveBeenCalledWith('gasAccount');

    rerender({
      ...baseParams,
      gasMethod: 'gasAccount' as const,
      setGasMethod,
    });

    setGasMethod.mockClear();

    rerender({
      ...baseParams,
      gasMethod: 'native' as const,
      setGasMethod,
    });

    expect(setGasMethod).not.toHaveBeenCalled();
  });
});
