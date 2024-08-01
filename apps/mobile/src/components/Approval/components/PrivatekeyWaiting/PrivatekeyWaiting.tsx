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
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApprovalPopupContainer,
  Props as ApprovalPopupContainerProps,
} from '../Popup/ApprovalPopupContainer';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { stats } from '@/utils/stats';
import {
  KEYRING_CATEGORY_MAP,
  KEYRING_CLASS,
} from '@rabby-wallet/keyring-utils';
import { matomoRequestEvent } from '@/utils/analytics';
import { adjustV } from '@/utils/gnosis';
import { getWalletIcon } from '@/utils/walletInfo';
import { apisSafe } from '@/core/apis/safe';
import { emitSignComponentAmounted } from '@/core/utils/signEvent';
import { useFindChain } from '@/hooks/useFindChain';

interface ApprovalParams {
  address: string;
  chainId?: number;
  isGnosis?: boolean;
  data?: string[];
  account?: Account;
  $ctx?: any;
  extra?: Record<string, any>;
  type: string;
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

export const PrivatekeyWaiting = ({ params }: { params: ApprovalParams }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { setTitle, setVisible, closePopup, setHeight } = useCommonPopupView();
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { type } = params;
  const [errorMessage, setErrorMessage] = React.useState('');
  const chain = useFindChain({
    id: params.chainId || 1,
  });
  const [connectStatus, setConnectStatus] = React.useState(
    APPROVAL_STATUS_MAP.SUBMITTING,
  );
  const [result, setResult] = React.useState('');
  const [isClickDone, setIsClickDone] = React.useState(false);
  const [signFinishedData, setSignFinishedData] = React.useState<{
    data: any;
    approvalId: string;
  }>();
  const [statusProp, setStatusProp] =
    React.useState<ApprovalPopupContainerProps['status']>('SENDING');
  const [content, setContent] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleRetry = async () => {
    if (connectStatus === APPROVAL_STATUS_MAP.SUBMITTING) {
      toast.success(t('page.signFooterBar.ledger.resubmited'));
      return;
    }
    setConnectStatus(APPROVAL_STATUS_MAP.SUBMITTING);
    await notificationService.callCurrentRequestDeferFn();
    toast.success(t('page.signFooterBar.ledger.resent'));
    emitSignComponentAmounted();
  };

  const handleCancel = () => {
    rejectApproval('user cancel');
  };

  const binaryTheme = useGetBinaryMode();
  const isLight = binaryTheme === 'light';

  const brandContent = React.useMemo(() => {
    switch (type) {
      case KEYRING_CLASS.PRIVATE_KEY:
        return {
          name: 'Private Key',
          icon: getWalletIcon(KEYRING_CLASS.PRIVATE_KEY, !isLight),
        };
      case KEYRING_CLASS.MNEMONIC:
        return {
          name: 'Seed Phrase',
          icon: getWalletIcon(KEYRING_CLASS.MNEMONIC, !isLight),
        };
      default:
        break;
    }
  }, [type, isLight]);

  const init = async () => {
    const account = params.isGnosis
      ? params.account!
      : (await preferenceService.getCurrentAccount())!;

    const approval = (await getApproval())!;

    const isSignText = params.isGnosis
      ? true
      : approval?.data.approvalType !== 'SignTx';

    if (!isSignText) {
      const signingTxId = approval.data.params.signingTxId;
      if (signingTxId) {
        const signingTx = await transactionHistoryService.getSigningTx(
          signingTxId,
        );

        if (!signingTx?.explain && chain && !chain.isTestnet) {
          setErrorMessage(t('page.signFooterBar.qrcode.failedToGetExplain'));
          return;
        }

        const explain = signingTx?.explain;

        stats.report('signTransaction', {
          type: account.brandName,
          chainId: chain?.serverId || '',
          category: KEYRING_CATEGORY_MAP[account.type],
          preExecSuccess: explain
            ? explain?.calcSuccess && explain?.pre_exec.success
            : true,
          createdBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
          source: params?.$ctx?.ga?.source || '',
          trigger: params?.$ctx?.ga?.trigger || '',
          networkType: chain?.isTestnet
            ? 'Custom Network'
            : 'Integrated Network',
        });
      }
    } else {
      stats.report('startSignText', {
        type: account.brandName,
        category: KEYRING_CATEGORY_MAP[account.type],
        method: params?.extra?.signTextMethod,
      });
    }

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
              await apisSafe.gnosisAddConfirmation(account.address, data.data);
            } else {
              await apisSafe.gnosisAddSignature(account.address, data.data);
              await apisSafe.postGnosisTransaction();
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
          label: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
        });
        setSignFinishedData({
          data: sig,
          approvalId: approval.id,
        });
      } else {
        setConnectStatus(APPROVAL_STATUS_MAP.FAILED);
        setErrorMessage(data.errorMsg);
      }
    });

    emitSignComponentAmounted();
  };

  const Icon = brandContent?.icon;

  React.useEffect(() => {
    init();

    return () => {
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

  React.useEffect(() => {
    setVisible(true);
    switch (connectStatus) {
      case APPROVAL_STATUS_MAP.WAITING:
      case APPROVAL_STATUS_MAP.SUBMITTING:
        setStatusProp('SENDING');
        setContent(t('page.signFooterBar.ledger.submitting'));
        setDescription('');
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
        setDescription('');
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectStatus, errorMessage]);

  return (
    <View>
      <View style={styles.titleWrapper}>
        {Icon && <Icon width={20} height={20} style={styles.brandIcon} />}

        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', {
            brand: brandContent?.name,
          })}
        </Text>
      </View>

      <ApprovalPopupContainer
        showAnimation
        hdType={'privatekey'}
        status={statusProp}
        onRetry={handleRetry}
        content={renderContent}
        description={description}
        onDone={() => setIsClickDone(true)}
        onCancel={handleCancel}
        hasMoreDescription={!!description}
      />
    </View>
  );
};
