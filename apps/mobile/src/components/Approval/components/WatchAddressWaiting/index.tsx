import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Process from './Process';
import { useApproval } from '@/hooks/useApproval';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { useSessionStatus } from '@/hooks/useSessionStatus';
import { eventBus, EVENTS } from '@/utils/events';
import { WALLETCONNECT_STATUS_MAP } from '@rabby-wallet/eth-walletconnect-keyring/type';
import { toast } from '@/components/Toast';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { apisWalletConnect } from '@/core/apis';
import { View } from 'react-native';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { matomoRequestEvent } from '@/utils/analytics';
import { findChain, findChainByEnum } from '@/utils/chain';
import { KEYRING_CATEGORY_MAP } from '@rabby-wallet/keyring-utils';
import { stats } from '@/utils/stats';
import { adjustV } from '@/utils/gnosis';
import { apisSafe } from '@/core/apis/safe';
import { emitSignComponentAmounted } from '@/core/utils/signEvent';

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
  const { setVisible, closePopup } = useCommonPopupView();
  const [connectStatus, setConnectStatus] = useState(
    WALLETCONNECT_STATUS_MAP.WAITING,
  );
  const [connectError, setConnectError] = useState<null | {
    code?: number;
    message?: string;
  }>(null);

  const [result, setResult] = useState('');
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const chain = findChain({
    id: params.chainId || 1,
  })!.enum;
  const isSignTextRef = useRef(false);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const explainRef = useRef<any | null>(null);
  const [signFinishedData, setSignFinishedData] = useState<{
    data: any;
    approvalId: string;
  }>();
  const [isClickDone, setIsClickDone] = useState(false);
  const { status: sessionStatus } = useSessionStatus(currentAccount!);
  const { t } = useTranslation();
  const { openWalletByBrandName } = useValidWalletServices();

  const initWalletConnect = async () => {
    const account = params.isGnosis
      ? params.account!
      : (await preferenceService.getCurrentAccount())!;
    const status = await apisWalletConnect.getWalletConnectStatus(
      account.address,
      account.brandName,
    );
    if (status) {
      setConnectStatus(
        status === null ? WALLETCONNECT_STATUS_MAP.PENDING : status,
      );
    }

    const signingTx = await transactionHistoryService.getSigningTx(
      params.signingTxId!,
    );

    explainRef.current = signingTx?.explain;
    if (
      status !== WALLETCONNECT_STATUS_MAP.CONNECTED &&
      status !== WALLETCONNECT_STATUS_MAP.SIBMITTED
    ) {
      eventBus.emit(EVENTS.broadcastToBackground, {
        method: EVENTS.WALLETCONNECT.INIT,
        data: account,
      });
    }
  };
  const handleCancel = () => {
    rejectApproval('user cancel');
  };

  const handleRetry = async () => {
    const account = params.isGnosis
      ? params.account!
      : (await preferenceService.getCurrentAccount())!;

    setConnectStatus(WALLETCONNECT_STATUS_MAP.PENDING);
    setConnectError(null);
    apisWalletConnect.resendWalletConnect(account);
    emitSignComponentAmounted();
    openWalletByBrandName(account.brandName);
    toast.success(t('page.signFooterBar.walletConnect.requestSuccessToast'));
  };

  const init = async () => {
    const approval = await getApproval();
    const account = params.isGnosis
      ? params.account!
      : (await preferenceService.getCurrentAccount())!;

    setCurrentAccount(account);

    let isSignTriggered = false;
    const isText = params.isGnosis
      ? true
      : approval?.data.approvalType !== 'SignTx';
    isSignTextRef.current = isText;

    eventBus.addListener(EVENTS.SIGN_FINISHED, async data => {
      if (data.success) {
        let sig = data.data;
        setResult(sig);
        try {
          if (params.isGnosis) {
            sig = adjustV('eth_signTypedData', sig);
            const sigs = await apisSafe.getGnosisTransactionSignatures();
            if (sigs.length > 0) {
              await apisSafe.gnosisAddConfirmation(account.address, sig);
            } else {
              await apisSafe.gnosisAddSignature(account.address, sig);
              await apisSafe.postGnosisTransaction();
            }
          }
        } catch (e: any) {
          rejectApproval(e.message);
          return;
        }
        setSignFinishedData({
          data: sig,
          approvalId: approval!.id,
        });
      } else {
        rejectApproval(data.errorMsg);
      }
    });

    eventBus.addListener(
      EVENTS.WALLETCONNECT.STATUS_CHANGED,
      async ({ status, payload }) => {
        setVisible(true);
        setConnectStatus(status);
        if (
          status !== WALLETCONNECT_STATUS_MAP.FAILD &&
          status !== WALLETCONNECT_STATUS_MAP.REJECTED
        ) {
          if (!isText && !isSignTriggered) {
            const explain = explainRef.current;

            if (explain) {
              stats.report('signTransaction', {
                type: account.brandName,
                chainId: findChainByEnum(chain)?.serverId || '',
                category: KEYRING_CATEGORY_MAP[account.type],
                preExecSuccess: explain
                  ? explain?.calcSuccess && explain?.pre_exec?.success
                  : true,
                createdBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
                source: params?.$ctx?.ga?.source || '',
                trigger: params?.$ctx?.ga?.trigger || '',
              });
            }
            matomoRequestEvent({
              category: 'Transaction',
              action: 'Submit',
              label: account.brandName,
            });
            isSignTriggered = true;
          }
          if (isText && !isSignTriggered) {
            stats.report('startSignText', {
              type: account.brandName,
              category: KEYRING_CATEGORY_MAP[account.type],
              method: params?.extra?.signTextMethod,
            });
            isSignTriggered = true;
          }
        }
        switch (status) {
          case WALLETCONNECT_STATUS_MAP.CONNECTED:
            break;
          case WALLETCONNECT_STATUS_MAP.FAILD:
          case WALLETCONNECT_STATUS_MAP.REJECTED:
            if (payload?.code) {
              try {
                const error = JSON.parse(payload.message);
                setConnectError({
                  code: payload.code,
                  message: error.message,
                });
              } catch (e) {
                setConnectError(payload);
              }
            } else {
              setConnectError(
                (payload?.params && payload.params[0]) || payload,
              );
            }
            break;
          case WALLETCONNECT_STATUS_MAP.SIBMITTED:
            setResult(payload);
            break;
        }
      },
    );
    initWalletConnect();
    emitSignComponentAmounted();
  };

  useEffect(() => {
    init();

    return () => {
      eventBus.removeAllListeners(EVENTS.SIGN_FINISHED);
      eventBus.removeAllListeners(EVENTS.WALLETCONNECT.STATUS_CHANGED);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (signFinishedData && isClickDone) {
      closePopup();
      resolveApproval(
        signFinishedData.data,
        false,
        false,
        signFinishedData.approvalId,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signFinishedData, isClickDone]);

  useEffect(() => {
    if (sessionStatus === 'DISCONNECTED') {
      setVisible(false);
      toast.info(t('page.signFooterBar.ledger.notConnected'));
    } else {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  useEffect(() => {
    if (currentAccount) {
      openWalletByBrandName(currentAccount.brandName);
    }
  }, [currentAccount, openWalletByBrandName]);

  return (
    <View>
      {currentAccount && (
        <Process
          chain={chain}
          result={result}
          status={connectStatus}
          error={connectError}
          onRetry={handleRetry}
          onCancel={handleCancel}
          account={currentAccount}
          onDone={() => setIsClickDone(true)}
        />
      )}
    </View>
  );
};
