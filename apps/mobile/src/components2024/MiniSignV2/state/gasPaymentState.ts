import { shouldAutoSwitchToApprovalGasAccount } from '@/components/Approval/components/TxComponents/GasSelector/approvalGasDisplay';

type MiniSignGasState = {
  gasMethod?: 'native' | 'gasAccount';
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

export type MiniSignSubmitGasMode = 'native' | 'gasAccount' | 'gasless';

export const isMiniSignGasAccountChainSupported = (
  state: Pick<MiniSignGasState, 'gasAccount'>,
) => !!state.gasAccount && !state.gasAccount.chain_not_support;

const shouldAutoSwitchToGasAccount = (state: MiniSignGasState) => {
  return shouldAutoSwitchToApprovalGasAccount({
    nativeTokenInsufficient: !!state.isGasNotEnough,
    freeGasAvailable: !!state.gasless?.is_gasless,
    gasAccountChainSupported: isMiniSignGasAccountChainSupported(state),
    noCustomRPC: !!state.noCustomRPC,
  });
};

export const normalizeMiniSignGasState = <T extends MiniSignGasState>(
  state: T,
): T => {
  const currentGasMethod = state.gasMethod ?? 'native';
  const nextGasMethod = shouldAutoSwitchToGasAccount(state)
    ? 'gasAccount'
    : 'native';
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
