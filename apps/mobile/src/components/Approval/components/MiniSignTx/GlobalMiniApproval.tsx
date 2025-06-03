import { useCurrentAccount } from '@/hooks/account';
import { miniApprovalAtom } from '@/hooks/useMiniApproval';
import { useClearMiniApprovalTask } from '@/hooks/useMiniApprovalTask';
import { EVENT_ROUTE_CHANGE, eventBus } from '@/utils/events';
import { useMemoizedFn, useMount } from 'ahooks';
import { useAtom } from 'jotai';
import React, { useRef } from 'react';
import { toastWithDotAnimation } from '@/components2024/Toast';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { MiniDirectSubmitApproval } from './DirectSubmitMiniSigntx';
import { MiniApproval } from './MiniSignTx';

export const GlobalMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const currentAccount = state.account;
  console.log('currentAccountMini', currentAccount);
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

  const handleSubmitted = useMemoizedFn(() => {
    submittingToastRef?.current?.();
  });

  useMount(() => {
    eventBus.on(EVENT_ROUTE_CHANGE, () => {
      clear();
      state?.onReject?.();
      setState({ txs: [], visible: false, directSubmit: false });
      submittingToastRef?.current?.();
    });
  });
  if (!currentAccount) {
    return null;
  }

  if (state.directSubmit) {
    return (
      <MiniDirectSubmitApproval
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
  }

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
