import { useClearMiniApprovalTask } from '@/hooks/useMiniApprovalTask';
import { EVENT_ROUTE_CHANGE, eventBus } from '@/utils/events';
import { useMemoizedFn, useMount } from 'ahooks';
import React, { useRef } from 'react';
import { toastWithDotAnimation } from '@/components2024/Toast';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { MiniDirectSubmitTypedDataApproval } from './DirectSubmitMiniSignTypedData';
import { useMiniSignTypedDataApprovalState } from '@/hooks/useMiniSignTypedDataApproval';

export const GlobalMiniSignTypedDataApproval = () => {
  const [state, setState] = useMiniSignTypedDataApprovalState();
  const currentAccount = state.account;
  const { clear } = useClearMiniApprovalTask();
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

  const handleSubmitted = useMemoizedFn(() => {
    submittingToastRef?.current?.();
  });

  useMount(() => {
    eventBus.on(EVENT_ROUTE_CHANGE, () => {
      clear();
      state?.onReject?.();
      setState({ txs: [], directSubmit: false });
      submittingToastRef?.current?.();
    });
  });
  if (!currentAccount) {
    return null;
  }

  return (
    <MiniDirectSubmitTypedDataApproval
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
