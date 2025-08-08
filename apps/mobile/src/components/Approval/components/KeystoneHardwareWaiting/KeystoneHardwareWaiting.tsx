import { transactionHistoryService } from '@/core/services/shared';
import { Account } from '@/core/services/preference';
import { useApproval } from '@/hooks/useApproval';
import { eventBus, EVENTS } from '@/utils/events';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { apiKeystone } from '@/core/apis';
import { findChain, findChainByEnum } from '@/utils/chain';
import Player from './Player';
import Reader from './Reader';
import { adjustV } from '@/utils/gnosis';
import { apisSafe } from '@/core/apis/safe';
import { emitSignComponentAmounted } from '@/core/utils/signEvent';
import { Spin } from '@/components/Spin';
import { useUnmount } from 'ahooks';

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
    container: {
      marginTop: 30,
    },
    payloadEmptyContainer: {
      width: 440,
      height: 440,
      marginBottom: -100,
    },
  });

export const KeystoneHardwareWaiting = ({
  params,
  account: $account,
}: {
  params: ApprovalParams;
  account: Account;
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
  const account = params.isGnosis ? params.account! : $account;
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const chain = findChain({
    id: params.chainId || 1,
  })!.enum;

  const cancelRef = useRef(false);

  const init = useCallback(async () => {
    const approval = await getApproval();
    if (!account) {
      return;
    }
    setBrand(account.brandName);
    setIsSignText(
      params.isGnosis ? true : approval?.data.approvalType !== 'SignTx',
    );

    eventBus.addListener(
      EVENTS.QRHARDWARE.ACQUIRE_MEMSTORE_SUCCEED,
      async ({ request }) => {
        let currentSignId: string | null = null;
        if (account.brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName) {
          currentSignId = await apiKeystone.exportCurrentSignRequestIdIfExist();
        }
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
        cancelRef.current = true;
        let sig = data.data;
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
                await apisSafe.gnosisAddConfirmation(account.address, sig);
              } else {
                await apisSafe.gnosisAddSignature(account.address, sig);
                await apisSafe.postGnosisTransaction();
              }
            }
          }
        } catch (e: any) {
          setErrorMessage(e.message);
          // rejectApproval(e.message);
          return;
        }
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
    emitSignComponentAmounted();
    setTimeout(() => {
      apiKeystone.acquireKeystoneMemStoreData();
    }, 500);
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
    cancelRef.current = true;
    rejectApproval('user cancel');
  };

  useUnmount(() => {
    if (!cancelRef.current) {
      rejectApproval('user cancel');
    }
  });
  const handleRequestSignature = async () => {
    const approval = await getApproval();
    if (account) {
      if (!isSignText) {
        const signingTxId = approval?.data?.params?.signingTxId;
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
      setErrorMessage('');
      setStatus(QR_HARDWARE_STATUS.SIGN);
      emitSignComponentAmounted();
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
      handleSubmit();
      setContent(t('page.signFooterBar.qrcode.submitting'));
      return 'SENDING';
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
    <View>
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
          hdType="keystone"
          status={popupStatus}
          content={renderContent}
          description={errorMessage}
          onCancel={handleCancel}
          onRetry={handleRequestSignature}
          onDone={() => setIsClickDone(true)}
          onSubmit={handleSubmit}
          hasMoreDescription={!!errorMessage}
          style={styles.container}
        />
      ) : (
        <>
          {status === QR_HARDWARE_STATUS.SYNC &&
            (signPayload ? (
              <Player
                layoutStyle={'compact'}
                playerSize={230}
                type={signPayload.payload.type}
                cbor={signPayload.payload.cbor}
                onSign={handleRequestSignature}
                brandName={account?.brandName}
              />
            ) : (
              <Spin size="large" hasMask={false}>
                <View style={styles.payloadEmptyContainer} />
              </Spin>
            ))}
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
