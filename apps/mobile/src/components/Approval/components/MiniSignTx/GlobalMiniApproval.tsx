import { useCurrentAccount } from '@/hooks/account';
import { miniApprovalAtom } from '@/hooks/useMiniApproval';
import { useClearMiniApprovalTask } from '@/hooks/useMiniApprovalTask';
import { EVENT_ROUTE_CHANGE, eventBus } from '@/utils/events';
import { useMemoizedFn, useMount } from 'ahooks';
import { useAtom } from 'jotai';
import React, { useRef } from 'react';
import { MiniApproval } from './MiniSignTx';
import { toast } from '@/components2024/Toast';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const GlobalMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });
  const { clear } = useClearMiniApprovalTask();
  // const [currentRoute, setCurrentRoute] = useState(getLatestNavigationName());
  const submittingToastRef = useRef<ReturnType<typeof toast.show> | null>(null);
  const handleSubmitting = useMemoizedFn(() => {
    if (
      [KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY].includes(
        currentAccount?.type || ('' as any),
      )
    ) {
      submittingToastRef?.current?.();
      submittingToastRef.current = toast.show('Submitting Transaction...', {
        duration: 0,
      });
    }
  });

  const handleSubmitted = useMemoizedFn(() => {
    submittingToastRef?.current?.();
  });

  useMount(() => {
    eventBus.on(EVENT_ROUTE_CHANGE, () => {
      clear();
      state?.onReject?.();
      setState({ txs: [], visible: false });
      submittingToastRef?.current?.();
    });
  });

  return (
    <MiniApproval
      {...state}
      key={`${currentAccount?.type}-${currentAccount?.address}`}
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
