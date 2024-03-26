import { CHAINS } from '@/constant/chains';
import { transactionHistoryService } from '@/core/services/shared';
import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import { eventBus, EVENTS } from '@/utils/events';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalPopupContainer } from '../Popup/ApprovalPopupContainer';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { StyleSheet, Text, View } from 'react-native';
import KeystoneSVG from '@/assets/icons/wallet/keystone.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { stats } from '@/utils/stats';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CATEGORY_MAP,
} from '@rabby-wallet/keyring-utils';
import { useCurrentAccount } from '@/hooks/account';
import { apiKeystone } from '@/core/apis';
import { findChainByEnum } from '@/utils/chain';
import Player from './Player';
import Reader from './Reader';

enum QR_HARDWARE_STATUS {
  SYNC,
  SIGN,
  RECEIVED,
  DONE,
}
export type RequestSignPayload = {
  requestId: string;
  payload: {
    type: string;
    cbor: string;
  };
};

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
    root: {
      flex: 1,
    },
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

export const KeystoneHardwareWaiting = ({
  params,
}: {
  params: ApprovalParams;
}) => {
  const { closePopup } = useCommonPopupView();
  const [status, setStatus] = useState<QR_HARDWARE_STATUS>(
    QR_HARDWARE_STATUS.SYNC,
  );
  const [brand, setBrand] = useState<string>('');
  const [signPayload, setSignPayload] = useState<RequestSignPayload>();
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const [errorMessage, setErrorMessage] = useState('');
  const [isSignText, setIsSignText] = useState(false);
  const { t } = useTranslation();
  const [content, setContent] = React.useState('');
  const [isClickDone, setIsClickDone] = React.useState(false);
  const [signFinishedData, setSignFinishedData] = React.useState<{
    data: any;
    stay: boolean;
    approvalId: string;
  }>();
  const { currentAccount: account } = useCurrentAccount();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const chain = Object.values(CHAINS).find(
    item => item.id === (params.chainId || 1),
  )!.enum;
  const init = useCallback(async () => {
    const approval = await getApproval();
    if (!account) {
      return;
    }
    setBrand(account.brandName);
    setIsSignText(
      params.isGnosis ? true : approval?.data.approvalType !== 'SignTx',
    );

    let currentSignId: string | null = null;
    if (account.brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName) {
      currentSignId = await apiKeystone.exportCurrentSignRequestIdIfExist();
    }

    eventBus.addListener(
      EVENTS.QRHARDWARE.ACQUIRE_MEMSTORE_SUCCEED,
      ({ request }) => {
        if (currentSignId) {
          if (currentSignId === request.requestId) {
            setSignPayload(request);
          }
          return;
        } else {
          setSignPayload(request);
        }
      },
    );
    eventBus.addListener(EVENTS.SIGN_FINISHED, async data => {
      if (data.success) {
        let sig = data.data;
        setStatus(QR_HARDWARE_STATUS.DONE);
        setSignFinishedData({
          data: sig,
          stay: !isSignText,
          approvalId: approval!.id,
        });
      } else {
        setErrorMessage(data.errorMsg);
      }
    });
    await apiKeystone.acquireKeystoneMemStoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    init();
    return () => {
      eventBus.removeAllListeners(EVENTS.SIGN_FINISHED);
      eventBus.removeAllListeners(EVENTS.QRHARDWARE.ACQUIRE_MEMSTORE_SUCCEED);
    };
  }, [init]);

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

  const handleCancel = () => {
    rejectApproval('User rejected the request.');
  };
  const handleRequestSignature = async () => {
    const approval = (await getApproval())!;
    if (account) {
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
            chainId: findChainByEnum(chain)?.serverId || '',
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
      setErrorMessage('');
      setStatus(QR_HARDWARE_STATUS.SIGN);
    }
  };

  const [scanMessage, setScanMessage] = React.useState();
  const handleScan = scanMessage => {
    setScanMessage(scanMessage);
    setStatus(QR_HARDWARE_STATUS.RECEIVED);
  };

  const handleSubmit = async () => {
    apiKeystone.submitQRHardwareSignature(signPayload!.requestId, scanMessage!);
  };

  const popupStatus = React.useMemo(() => {
    if (errorMessage) {
      setContent(t('page.signFooterBar.qrcode.txFailed'));
      return 'FAILED';
    }

    if (status === QR_HARDWARE_STATUS.RECEIVED) {
      setContent(t('page.signFooterBar.qrcode.sigReceived'));
      return 'SUBMITTING';
    }
    if (status === QR_HARDWARE_STATUS.DONE) {
      setContent(t('page.signFooterBar.qrcode.sigCompleted'));
      return 'RESOLVED';
    }
    if ([QR_HARDWARE_STATUS.SIGN, QR_HARDWARE_STATUS.SYNC].includes(status)) {
      setContent('');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, errorMessage]);

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
    <View style={styles.root}>
      <View style={styles.titleWrapper}>
        <KeystoneSVG width={20} height={20} style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', {
            brand,
          })}
        </Text>
      </View>
      {popupStatus ? (
        <ApprovalPopupContainer
          showAnimation
          hdType="qrcode"
          status={popupStatus}
          content={renderContent}
          description={errorMessage}
          onCancel={handleCancel}
          onRetry={handleRequestSignature}
          onDone={() => setIsClickDone(true)}
          onSubmit={handleSubmit}
          hasMoreDescription={!!errorMessage}
        />
      ) : (
        <>
          {status === QR_HARDWARE_STATUS.SYNC && signPayload && (
            <Player
              layoutStyle={'compact'}
              playerSize={165}
              type={signPayload.payload.type}
              cbor={signPayload.payload.cbor}
              onSign={handleRequestSignature}
              brandName={account?.brandName}
            />
          )}
          {status === QR_HARDWARE_STATUS.SIGN && (
            <Reader
              onBack={() => setStatus(QR_HARDWARE_STATUS.SYNC)}
              requestId={signPayload?.requestId}
              setErrorMessage={setErrorMessage}
              brandName={account?.brandName}
              onScan={handleScan}
            />
          )}
        </>
      )}
    </View>
  );
};
