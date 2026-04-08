type MiniSignGasState = {
  gasMethod?: 'native' | 'gasAccount';
  useGasless?: boolean;
  isGasNotEnough?: boolean;
  gasless?: {
    is_gasless?: boolean;
  } | null;
  gasAccount?: {
    chain_not_support?: boolean;
  } | null;
};

export type MiniSignSubmitGasMode = 'native' | 'gasAccount' | 'gasless';

export const isMiniSignGasAccountChainSupported = (
  state: Pick<MiniSignGasState, 'gasAccount'>,
) => !!state.gasAccount && !state.gasAccount.chain_not_support;

export const normalizeMiniSignGasState = <T extends MiniSignGasState>(
  state: T,
): T => {
  const currentGasMethod = state.gasMethod ?? 'native';
  const shouldFallbackToNative =
    currentGasMethod === 'gasAccount' &&
    (!state.isGasNotEnough || !isMiniSignGasAccountChainSupported(state));
  const nextGasMethod = shouldFallbackToNative ? 'native' : currentGasMethod;
  const nextUseGasless =
    nextGasMethod === 'gasAccount' ? false : !!state.useGasless;

  if (
    nextGasMethod === currentGasMethod &&
    nextUseGasless === !!state.useGasless
  ) {
    return state;
  }

  return {
    ...state,
    gasMethod: nextGasMethod,
    useGasless: nextUseGasless,
  };
};

export const resolveMiniSignSubmitGasMode = ({
  gasMethod = 'native',
  useGasless = false,
}: Pick<
  MiniSignGasState,
  'gasMethod' | 'useGasless'
>): MiniSignSubmitGasMode => {
  if (gasMethod === 'gasAccount') {
    return 'gasAccount';
  }

  return useGasless ? 'gasless' : 'native';
};
