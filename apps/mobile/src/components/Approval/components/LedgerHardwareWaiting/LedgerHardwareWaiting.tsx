import * as Sentry from '@sentry/react-native';
import { toast } from '@/components/Toast';
import { CHAINS } from '@/constant/chains';
import {
  notificationService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services/shared';
import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import { APPROVAL_STATUS_MAP, eventBus, EVENTS } from '@/utils/events';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApprovalPopupContainer,
  Props as ApprovalPopupContainerProps,
} from '../Popup/ApprovalPopupContainer';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { StyleSheet, Text, View } from 'react-native';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
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

interface ApprovalParams {
  address: string;
  chainId?: number;
  isGnosis?: boolean;
  data?: string[];
  account?: Account;
  $ctx?: any;
  extra?: Record<string, any>;
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
      fontWeight: '500',
      lineHeight: 24,
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  });

export const LedgerHardwareWaiting = ({
  params,
}: {
  params: ApprovalParams;
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
  const chain = Object.values(CHAINS).find(
    item => item.id === (params.chainId || 1),
  )!;
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

  const handleCancel = () => {
    rejectApproval('user cancel');
  };

  const handleRetry = async (showToast = true) => {
    if (connectStatus === APPROVAL_STATUS_MAP.SUBMITTING) {
      toast.success(t('page.signFooterBar.ledger.resubmitted'));
      return;
    }
    setConnectStatus(APPROVAL_STATUS_MAP.WAITING);
    await notificationService.callCurrentRequestDeferFn();
    if (showToast) {
      toast.success(t('page.signFooterBar.ledger.resent'));
    }
  };

  const init = async () => {
    const account = params.isGnosis
      ? params.account!
      : (await preferenceService.getCurrentAccount())!;
    const approval = (await getApproval())!;

    const isSignText = params.isGnosis
      ? true
      : approval?.data.approvalType !== 'SignTx';
    setIsSignText(isSignText);
    if (!isSignText) {
      const signingTxId = approval.data.params.signingTxId;
      // const tx = approval.data?.params;
      if (signingTxId) {
        // const { nonce, from, chainId } = tx;
        // const explain = await wallet.getExplainCache({
        //   nonce: Number(nonce),
        //   address: from,
        //   chainId: Number(chainId),
        // });

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
            ? explain?.calcSuccess && explain?.pre_exec.success
            : true,
          createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
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
    eventBus.addListener(EVENTS.LEDGER.REJECT_APPROVAL, data => {
      rejectApproval(data, false, true);
    });
    eventBus.addListener(EVENTS.LEDGER.REJECTED, async data => {
      setErrorMessage(data);
      setConnectStatus(APPROVAL_STATUS_MAP.REJECTED);
    });
    eventBus.addListener(EVENTS.TX_SUBMITTING, async () => {
      setConnectStatus(APPROVAL_STATUS_MAP.SUBMITTING);
    });
    eventBus.addListener(EVENTS.SIGN_FINISHED, async data => {
      if (data.success) {
        let sig = data.data;
        setResult(sig);
        setConnectStatus(APPROVAL_STATUS_MAP.SUBMITTED);
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
        } catch (e) {
          Sentry.captureException(e);
          setConnectStatus(APPROVAL_STATUS_MAP.FAILED);
          return;
        }

        matomoRequestEvent({
          category: 'Transaction',
          action: 'Submit',
          label: KEYRING_CLASS.HARDWARE.LEDGER,
        });

        setSignFinishedData({
          data: sig,
          approvalId: approval.id,
        });
      } else {
        Sentry.captureException(
          new Error('Ledger sign error: ' + JSON.stringify(data)),
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
      eventBus.removeAllListeners(EVENTS.LEDGER.REJECT_APPROVAL);
      eventBus.removeAllListeners(EVENTS.LEDGER.REJECTED);
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

  const currentDescription = React.useMemo(() => {
    if (description?.includes('0x650f')) {
      return t('page.newAddress.ledger.error.lockedOrNoEthApp');
    }
    if (description?.includes('0x5515') || description?.includes('0x6b0c')) {
      return t('page.signFooterBar.ledger.unlockAlert');
    } else if (
      description?.includes('0x6e00') ||
      description?.includes('0x6b00')
    ) {
      return t('page.signFooterBar.ledger.updateFirmwareAlert');
    } else if (description?.includes('0x6985')) {
      return t('page.signFooterBar.ledger.txRejectedByLedger');
    }

    return description;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

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

  return (
    <View>
      <View style={styles.titleWrapper}>
        <LedgerSVG width={20} height={20} style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', { brand: 'Ledger' })}
        </Text>
      </View>

      <ApprovalPopupContainer
        showAnimation
        hdType="ledger"
        status={statusProp}
        onRetry={() => handleRetry()}
        onDone={() => setIsClickDone(true)}
        onCancel={handleCancel}
        description={currentDescription}
        content={renderContent}
        hasMoreDescription={
          statusProp === 'REJECTED' || statusProp === 'FAILED'
        }
      />
    </View>
  );
};
