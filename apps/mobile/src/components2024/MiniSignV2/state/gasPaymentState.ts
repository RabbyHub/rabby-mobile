import { resolveApprovalGasMethod } from '@/components/Approval/components/TxComponents/GasSelector/approvalGasDisplay';

export type MiniSignGasState = {
  gasMethod?: 'native' | 'gasAccount';
  gasMethodManuallyChanged?: boolean;
  useGasless?: boolean;
  noCustomRPC?: boolean;
  isGasNotEnough?: boolean;
  gasless?: {
    is_gasless?: boolean;
  } | null;
  gasAccount?: {
    chain_not_support?: boolean;
  } | null;
};

export type PreservedManualMiniSignGasMethodState = Pick<
  MiniSignGasState,
  'gasMethod' | 'gasMethodManuallyChanged' | 'useGasless'
>;

export type MiniSignSubmitGasMode = 'native' | 'gasAccount' | 'gasless';

export const isMiniSignGasAccountChainSupported = (
  state: Pick<MiniSignGasState, 'gasAccount'>,
) => !!state.gasAccount && !state.gasAccount.chain_not_support;

const resolveMiniSignGasMethod = (state: MiniSignGasState) => {
  const currentGasMethod = state.gasMethod ?? 'native';

  return resolveApprovalGasMethod({
    nativeTokenInsufficient: !!state.isGasNotEnough,
    freeGasAvailable: !!state.gasless?.is_gasless,
    gasAccountChainSupported: isMiniSignGasAccountChainSupported(state),
    noCustomRPC: !!state.noCustomRPC,
    legacyGasMethod: currentGasMethod,
  });
};

export const normalizeMiniSignGasState = <T extends MiniSignGasState>(
  state: T,
): T => {
  const currentGasMethod = state.gasMethod ?? 'native';
  const nextGasMethod = resolveMiniSignGasMethod(state);
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

export const preserveManualMiniSignGasMethod = <T extends MiniSignGasState>(
  previousState: MiniSignGasState | undefined,
  nextState: T,
): T => {
  const preservedState = getManualMiniSignGasMethodState(previousState);
  if (!preservedState?.gasMethod) {
    return nextState;
  }

  return {
    ...nextState,
    gasMethod: preservedState.gasMethod,
    gasMethodManuallyChanged: true,
    useGasless: preservedState.useGasless,
  };
};

export const getManualMiniSignGasMethodState = (
  state: MiniSignGasState | undefined,
): PreservedManualMiniSignGasMethodState | undefined => {
  if (!state?.gasMethodManuallyChanged || !state.gasMethod) {
    return undefined;
  }

  return {
    gasMethod: state.gasMethod,
    gasMethodManuallyChanged: true,
    useGasless: state.gasMethod === 'gasAccount' ? false : state.useGasless,
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
