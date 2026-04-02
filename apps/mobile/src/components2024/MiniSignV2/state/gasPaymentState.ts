type MiniSignGasState = {
  gasMethod?: 'native' | 'gasAccount';
  useGasless?: boolean;
  isGasNotEnough?: boolean;
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
  const nextGasMethod =
    state.gasMethod === 'gasAccount' &&
    (!state.isGasNotEnough || !isMiniSignGasAccountChainSupported(state))
      ? 'native'
      : state.gasMethod ?? 'native';
  const nextUseGasless =
    nextGasMethod === 'gasAccount' ? false : !!state.useGasless;

  if (
    nextGasMethod === (state.gasMethod ?? 'native') &&
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
