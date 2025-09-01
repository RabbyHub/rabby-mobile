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
      setState({ txs: [], visible: false, directSubmit: false });
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

// const sendMiniSignTypedData = useSendMiniSignTypedData();

// const testTypedData = async () => {
//   const result = await sendMiniSignTypedData({
//     account: currentAccount!,
//     txs: [
//       {
//         version: 'V4',
//         data: JSON.parse(
//           '{"domain":{"chainId":"42161","name":"Ether Mail","verifyingContract":"0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC","version":"1"},"message":{"contents":"Hello, Bob!","from":{"name":"Cow","wallets":["0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826","0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"]},"to":[{"name":"Bob","wallets":["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB","0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57","0xB0B0b0b0b0b0B000000000000000000000000000"]}],"attachment":"0x"},"primaryType":"Mail","types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Group":[{"name":"name","type":"string"},{"name":"members","type":"Person[]"}],"Mail":[{"name":"from","type":"Person"},{"name":"to","type":"Person[]"},{"name":"contents","type":"string"},{"name":"attachment","type":"bytes"}],"Person":[{"name":"name","type":"string"},{"name":"wallets","type":"address[]"}]}}',
//         ),
//         from: currentAccount!.address,
//       },
//     ],
//   })

//   console.log('result', result);
// };
