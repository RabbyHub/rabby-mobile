import { miniApprovalAtom } from '@/hooks/useMiniApproval';
import { useClearMiniApprovalTask } from '@/hooks/useMiniApprovalTask';
import { useMemoizedFn, useMount, useUnmount } from 'ahooks';
import { useAtom } from 'jotai';
import React, { useRef } from 'react';
import { toastWithDotAnimation } from '@/components2024/Toast';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
// import { MiniDirectSubmitApproval } from './DirectSubmitMiniSigntx';
import { MiniApproval } from './MiniSignTx';
import {
  useMemoMiniSignGasStore,
  useMiniSignGasStore,
} from '@/hooks/miniSignGasStore';
import { RootNames } from '@/constant/layout';
import { perfEvents } from '@/core/utils/perf';

const DON_AUTO_RESET_GAS_SCREEN = [
  RootNames.Swap,
  RootNames.MultiSwap,
  RootNames.Bridge,
  RootNames.MultiBridge,
  RootNames.Send,
  RootNames.MultiSend,
] as string[];

export const GlobalMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const currentAccount = state.account;
  const { clear } = useClearMiniApprovalTask();
  // const [currentRoute, setCurrentRoute] = useState(getLatestNavigationName());
  const submittingToastRef = useRef<ReturnType<
    typeof toastWithDotAnimation
  > | null>(null);
  const handleSubmitting = useMemoizedFn(() => {
    if (
      [KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY].includes(
        currentAccount?.type || ('' as any),
      ) &&
      !state?.directSubmit
    ) {
      submittingToastRef?.current?.();
      submittingToastRef.current = toastWithDotAnimation(
        'Submitting Transaction',
        {
          duration: 0,
        },
      );
    }
  });

  // prefetch data
  useMiniSignGasStore(-1);

  const { reset: resetMemoGas } = useMemoMiniSignGasStore();

  const handleSubmitted = useMemoizedFn(() => {
    submittingToastRef?.current?.();
  });

  const onEventRouteChange = useMemoizedFn(
    ({ currentRouteName }: { currentRouteName: string }) => {
      if (!DON_AUTO_RESET_GAS_SCREEN.includes(currentRouteName)) {
        resetMemoGas();
      }
      clear();
      state?.onReject?.();
      setState({ txs: [], visible: false, directSubmit: false });
      submittingToastRef?.current?.();
    },
  );

  useMount(() => {
    perfEvents.addListener('EVENT_ROUTE_CHANGE', onEventRouteChange);
  });

  useUnmount(() => {
    perfEvents.removeListener('EVENT_ROUTE_CHANGE', onEventRouteChange);
  });

  if (!currentAccount) {
    return null;
  }

  // if (state.directSubmit) {
  //   return (
  //     <MiniDirectSubmitApproval
  //       {...state}
  //       account={currentAccount}
  //       key={`${currentAccount?.type}-${currentAccount?.address}-${state.id}`}
  //       onSubmitting={handleSubmitting}
  //       onSubmitted={handleSubmitted}
  //       onVisibleChange={v => {
  //         setState(prev => {
  //           return {
  //             ...prev,
  //             visible: v,
  //           };
  //         });
  //       }}
  //     />
  //   );
  // }

  return (
    <MiniApproval
      {...state}
      account={currentAccount}
      key={`${currentAccount?.type}-${currentAccount?.address}-${state.id}`}
      onSubmitting={handleSubmitting}
      onSubmitted={handleSubmitted}
      onVisibleChange={v => {
        setState(prev => {
          return {
            ...prev,
            visible: v,
          };
        });
      }}
    />
  );
};
