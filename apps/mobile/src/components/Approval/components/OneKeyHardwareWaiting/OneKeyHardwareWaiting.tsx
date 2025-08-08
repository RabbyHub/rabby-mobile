import * as Sentry from '@sentry/react-native';
import { toast } from '@/components/Toast';
import {
  notificationService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services/shared';
import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import { APPROVAL_STATUS_MAP, eventBus, EVENTS } from '@/utils/events';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApprovalPopupContainer,
  Props as ApprovalPopupContainerProps,
} from '../Popup/ApprovalPopupContainer';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { StyleSheet, Text, View } from 'react-native';
import OneKeySVG from '@/assets/icons/wallet/onekey.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { stats } from '@/utils/stats';
import {
  KEYRING_CATEGORY_MAP,
  KEYRING_CLASS,
} from '@rabby-wallet/keyring-utils';
import { matomoRequestEvent } from '@/utils/analytics';
import { adjustV } from '@/utils/gnosis';
import { apisSafe } from '@/core/apis/safe';
import { emitSignComponentAmounted } from '@/core/utils/signEvent';
import { findChain } from '@/utils/chain';
import {
  getTxFailedResult,
  retryTxReset,
  RetryUpdateType,
  setRetryTxRecommendNonce,
  setRetryTxType,
  useDebugToastErrorTxRetryInfo,
} from '@/utils/errorTxRetry';
import useAsync from 'react-use/lib/useAsync';
import { useUnmount } from 'ahooks';

interface ApprovalParams {
  address: string;
  chainId?: number;
  isGnosis?: boolean;
  data?: string[];
  from?: string;
  nonce?: string;
  account?: Account;
  $ctx?: any;
  extra?: Record<string, any>;
  safeMessage?: {
    safeMessageHash: string;
    safeAddress: string;
    message: string;
    chainId: number;
  };
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    brandIcon: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    titleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      justifyContent: 'center',
      marginTop: 15,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    content: {
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
      fontFamily: 'SF Pro Rounded',
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  });

export const OneKeyHardwareWaiting = ({
  params,
  account: $account,
}: {
  params: ApprovalParams;
  account: Account;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { setVisible, visible, closePopup } = useCommonPopupView();
  const [statusProp, setStatusProp] =
    React.useState<ApprovalPopupContainerProps['status']>('SENDING');
  const [content, setContent] = React.useState('');
  const [description, setDescription] = React.useState('');

  const [connectStatus, setConnectStatus] = React.useState(
    APPROVAL_STATUS_MAP.WAITING,
  );
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const chain = findChain({
    id: params.chainId || 1,
  })!;
  const { t } = useTranslation();
  const [isSignText, setIsSignText] = React.useState(false);
  const [result, setResult] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isClickDone, setIsClickDone] = React.useState(false);
  const [signFinishedData, setSignFinishedData] = React.useState<{
    data: any;
    approvalId: string;
  }>();
  const firstConnectRef = React.useRef<boolean>(false);
  const mountedRef = React.useRef(false);
  const showDueToStatusChangeRef = React.useRef(false);

  const account = params.isGnosis ? params.account! : $account;

  const cancelRef = useRef(false);

  const handleCancel = () => {
    cancelRef.current = true;
    rejectApproval('user cancel');
  };

  useUnmount(() => {
    if (!cancelRef.current) {
      rejectApproval('user cancel');
    }
  });

  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async (showToast = true) => {
    if (isRetrying) {
      return;
    }
    if (connectStatus === APPROVAL_STATUS_MAP.SUBMITTING) {
      toast.success(t('page.signFooterBar.ledger.resubmited'));
      return;
    }
    setIsRetrying(true);

    setConnectStatus(APPROVAL_STATUS_MAP.WAITING);

    retryTxReset();
    if (params.nonce && params.chainId && params.from && account) {
      setRetryTxType(retryUpdateType);
      if (retryUpdateType === 'nonce') {
        try {
          await setRetryTxRecommendNonce({
            from: params.from,
            chainId: params.chainId,
            account: account,
            nonce: params.nonce,
          });
        } catch (error) {}
      }
    }

    notificationService.callCurrentRequestDeferFn(true);
    if (showToast) {
      toast.success(t('page.signFooterBar.ledger.resent'));
    }
    emitSignComponentAmounted();
    setIsRetrying(false);
  };

  const init = async () => {
    const account = params.isGnosis ? params.account! : $account;
    const approval = (await getApproval())!;

    const isSignText = params.isGnosis
      ? true
      : approval?.data.approvalType !== 'SignTx';
    setIsSignText(isSignText);
    if (!isSignText) {
      const signingTxId = approval.data.params.signingTxId;
      if (signingTxId) {
        const signingTx = await transactionHistoryService.getSigningTx(
          signingTxId,
        );

        if (!signingTx?.explain) {
          setErrorMessage(t('page.signFooterBar.qrcode.failedToGetExplain'));
          return;
        }

        const explain = signingTx.explain;

        stats.report('signTransaction', {
          type: account.brandName,
          chainId: chain.serverId,
          category: KEYRING_CATEGORY_MAP[account.type],
          preExecSuccess: explain
            ? explain?.calcSuccess && explain?.pre_exec?.success
            : true,
          createdBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
          source: params?.$ctx?.ga?.source || '',
          trigger: params?.$ctx?.ga?.trigger || '',
        });
      }
    } else {
      stats.report('startSignText', {
        type: account.brandName,
        category: KEYRING_CATEGORY_MAP[account.type],
        method: params?.extra?.signTextMethod,
      });
    }
    eventBus.addListener(EVENTS.COMMON_HARDWARE.REJECTED, async data => {
      setErrorMessage(data);
      setConnectStatus(APPROVAL_STATUS_MAP.REJECTED);
    });
    eventBus.addListener(EVENTS.TX_SUBMITTING, async () => {
      setConnectStatus(APPROVAL_STATUS_MAP.SUBMITTING);
    });
    eventBus.addListener(EVENTS.SIGN_FINISHED, async data => {
      if (data.success) {
        cancelRef.current = true;
        let sig = data.data;
        setResult(sig);
        setConnectStatus(APPROVAL_STATUS_MAP.SUBMITTED);
        try {
          if (params.isGnosis) {
            sig = adjustV('eth_signTypedData', sig);
            const safeMessage = params.safeMessage;
            if (safeMessage) {
              await apisSafe.handleGnosisMessage({
                signature: data.data,
                signerAddress: params.account!.address!,
              });
            } else {
              const sigs = await apisSafe.getGnosisTransactionSignatures();
              if (sigs.length > 0) {
                await apisSafe.gnosisAddConfirmation(
                  account.address,
                  data.data,
                );
              } else {
                await apisSafe.gnosisAddSignature(account.address, data.data);
                await apisSafe.postGnosisTransaction();
              }
            }
          }
        } catch (e: any) {
          setConnectStatus(APPROVAL_STATUS_MAP.FAILED);
          setErrorMessage(e.message);
          return;
        }

        matomoRequestEvent({
          category: 'Transaction',
          action: 'Submit',
          label: KEYRING_CLASS.HARDWARE.ONEKEY,
        });

        setSignFinishedData({
          data: sig,
          approvalId: approval.id,
        });
      } else {
        Sentry.captureException(
          new Error('OneKey sign error: ' + JSON.stringify(data)),
        );
        setConnectStatus(APPROVAL_STATUS_MAP.FAILED);
        setErrorMessage(data.errorMsg);
      }
    });

    emitSignComponentAmounted();
  };

  React.useEffect(() => {
    firstConnectRef.current = true;
  }, []);

  React.useEffect(() => {
    init();

    mountedRef.current = true;

    return () => {
      eventBus.removeAllListeners(EVENTS.COMMON_HARDWARE.REJECTED);
      eventBus.removeAllListeners(EVENTS.TX_SUBMITTING);
      eventBus.removeAllListeners(EVENTS.SIGN_FINISHED);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
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

  React.useEffect(() => {
    setVisible(true);
    showDueToStatusChangeRef.current = true;
    switch (connectStatus) {
      case APPROVAL_STATUS_MAP.WAITING:
        setStatusProp('SENDING');
        setContent(t('page.signFooterBar.ledger.siging'));
        setDescription('');
        break;
      case APPROVAL_STATUS_MAP.SUBMITTING:
        setStatusProp('SENDING');
        setContent(t('page.signFooterBar.ledger.submitting'));
        setDescription('');
        break;
      case APPROVAL_STATUS_MAP.REJECTED:
        setStatusProp('REJECTED');
        setContent(t('page.signFooterBar.ledger.txRejected'));
        setDescription(errorMessage);
        break;
      case APPROVAL_STATUS_MAP.FAILED:
        setStatusProp('FAILED');
        setContent(t('page.signFooterBar.qrcode.txFailed'));
        setDescription(errorMessage);
        break;
      case APPROVAL_STATUS_MAP.SUBMITTED:
        setStatusProp('RESOLVED');
        setContent(t('page.signFooterBar.qrcode.sigCompleted'));
        setDescription('');
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectStatus, errorMessage]);

  const { value: recommendNonce } = useAsync(async () => {
    if (params.nonce && params.chainId && params.from && account) {
      return setRetryTxRecommendNonce({
        from: params.from,
        chainId: params.chainId,
        account: account,
        nonce: params.nonce,
      });
    }
    return '0x0';
  }, [params.nonce, params.chainId, params.from, account]);

  const [currentDescription, retryUpdateType]: [string, RetryUpdateType] =
    React.useMemo(() => {
      return params.nonce &&
        params.chainId &&
        params.from &&
        account &&
        [APPROVAL_STATUS_MAP.REJECTED, APPROVAL_STATUS_MAP.FAILED].includes(
          connectStatus,
        )
        ? getTxFailedResult(description || '', { nonce: recommendNonce })
        : [description, 'origin'];
    }, [
      connectStatus,
      description,
      params.chainId,
      params.from,
      params.nonce,
      recommendNonce,
      account,
    ]);

  const renderContent = React.useCallback(
    ({ contentColor }) => (
      <View style={styles.contentWrapper}>
        <Text
          style={StyleSheet.flatten([
            styles.content,
            {
              color: colors[contentColor],
            },
          ])}>
          {content}
        </Text>
      </View>
    ),
    [colors, content, styles.content, styles.contentWrapper],
  );

  const showBranIconTitle =
    retryUpdateType &&
    retryUpdateType !== 'gasPrice' &&
    retryUpdateType !== 'nonce';

  useDebugToastErrorTxRetryInfo({
    description: description,
    isFailedTx:
      connectStatus === APPROVAL_STATUS_MAP.FAILED ||
      connectStatus === APPROVAL_STATUS_MAP.REJECTED,
    tx: params,
    account: $account,
  });

  return (
    <View>
      {showBranIconTitle && (
        <View style={styles.titleWrapper}>
          <OneKeySVG width={20} height={20} style={styles.brandIcon} />
          <Text style={styles.title}>
            {t('page.signFooterBar.qrcode.signWith', { brand: 'OneKey' })}
          </Text>
        </View>
      )}

      <ApprovalPopupContainer
        showAnimation
        hdType="onekey"
        status={statusProp}
        onRetry={() => handleRetry()}
        onDone={() => setIsClickDone(true)}
        onCancel={handleCancel}
        description={currentDescription}
        content={renderContent}
        hasMoreDescription={
          statusProp === 'REJECTED' || statusProp === 'FAILED'
        }
        BrandIcon={OneKeySVG}
        retryUpdateType={retryUpdateType}
      />
    </View>
  );
};
