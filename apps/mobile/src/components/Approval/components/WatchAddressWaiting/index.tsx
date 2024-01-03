import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { apisWalletConnect } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { eventBus, EVENTS } from '@/utils/events';
import React from 'react';
import { Text, View } from 'react-native';

interface ApprovalParams {
  address: string;
  chainId?: number;
  isGnosis?: boolean;
  data?: string[];
  account?: Account;
  $ctx?: any;
  extra?: Record<string, any>;
  signingTxId?: string;
}

export const WatchAddressWaiting = ({ params }: { params: ApprovalParams }) => {
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const { currentAccount } = useCurrentAccount();
  const colors = useThemeColors();
  const { openWalletByBrandName } = useValidWalletServices();
  const isSignTextRef = React.useRef(false);
  const [result, setResult] = React.useState('');
  const explainRef = React.useRef<any | null>(null);
  const [signFinishedData, setSignFinishedData] = React.useState<{
    data: any;
    approvalId: string;
  }>();

  const bindSignFinished = async data => {
    const approval = await getApproval();
    const account = params.isGnosis ? params.account! : currentAccount;
    let isSignTriggered = false;
    const isText = params.isGnosis
      ? true
      : approval?.data.approvalType !== 'SignTx';
    isSignTextRef.current = isText;

    if (data.success) {
      let sig = data.data;
      setResult(sig);
      toast.success(sig);
      try {
        // if (params.isGnosis) {
        //   sig = adjustV('eth_signTypedData', sig);
        //   const sigs = await wallet.getGnosisTransactionSignatures();
        //   if (sigs.length > 0) {
        //     await wallet.gnosisAddConfirmation(account.address, sig);
        //   } else {
        //     await wallet.gnosisAddSignature(account.address, sig);
        //     await wallet.postGnosisTransaction();
        //   }
        // }
      } catch (e: any) {
        rejectApproval(e.message);
        return;
      }
      if (!isSignTextRef.current) {
        // const tx = approval.data?.params;
        const explain = explainRef.current;
        if (explain) {
          // const { nonce, from, chainId } = tx;
          // const explain = await wallet.getExplainCache({
          //   nonce: Number(nonce),
          //   address: from,
          //   chainId: Number(chainId),
          // });
          //   wallet.reportStats('signedTransaction', {
          //     type: account.brandName,
          //     chainId: findChainByEnum(chain)?.serverId || '',
          //     category: KEYRING_CATEGORY_MAP[account.type],
          //     success: true,
          //     preExecSuccess: explain
          //       ? explain?.calcSuccess && explain?.pre_exec.success
          //       : true,
          //     createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
          //     source: params?.$ctx?.ga?.source || '',
          //     trigger: params?.$ctx?.ga?.trigger || '',
          //   });
        }
      }
      // TODO
      // setSignFinishedData({
      //   data: sig,
      //   approvalId: approval!.id,
      // });
      resolveApproval(sig, false, false, approval!.id);
    } else {
      if (!isSignTextRef.current) {
        // const tx = approval.data?.params;
        const explain = explainRef.current;
        if (explain) {
          // const { nonce, from, chainId } = tx;
          // const explain = await wallet.getExplainCache({
          //   nonce: Number(nonce),
          //   address: from,
          //   chainId: Number(chainId),
          // });
          // wallet.reportStats('signedTransaction', {
          //   type: account.brandName,
          //   chainId: findChainByEnum(chain)?.serverId || '',
          //   category: KEYRING_CATEGORY_MAP[account.type],
          //   success: false,
          //   preExecSuccess: explain
          //     ? explain?.calcSuccess && explain?.pre_exec.success
          //     : true,
          //   createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
          //   source: params?.$ctx?.ga?.source || '',
          //   trigger: params?.$ctx?.ga?.trigger || '',
          // });
        }
      }
      rejectApproval(data.errorMsg);
    }
  };

  React.useEffect(() => {
    eventBus.addListener(EVENTS.SIGN_FINISHED, bindSignFinished);

    return () => {
      eventBus.removeListener(EVENTS.SIGN_FINISHED, bindSignFinished);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!currentAccount) {
      return;
    }
    apisWalletConnect
      .getDeepLink({
        address: currentAccount?.address,
        brandName: currentAccount?.brandName,
      })
      .then(uri => {
        if (uri) {
          openWalletByBrandName(currentAccount.brandName, uri);
        }
      });
  }, [currentAccount, openWalletByBrandName]);

  return (
    <View>
      <Text
        style={{
          fontSize: 30,
        }}>
        WatchAddressWaiting
      </Text>
      <Text>{currentAccount?.address}</Text>
    </View>
  );
};
