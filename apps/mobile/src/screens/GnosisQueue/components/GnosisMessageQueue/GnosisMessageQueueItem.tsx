import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { timeago } from '@/utils/time';
import { BasicSafeInfo, SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { ParseTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { GnosisMessageQueueConfirmations } from './GnosisMessageQueueConfirmations';
import { GnosisMessageExplain } from './GnosisMessageExplain';
import { isString } from 'lodash';
import { stringToHex } from 'viem';
import { sendRequest } from '@/core/apis/sendRequest';
import { findChain } from '@/utils/chain';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { apisSafe } from '@/core/apis/safe';
// import { GnosisTransactionExplain } from './GnosisTransactionExplain';
// import { GnosisTransactionConfirmations } from './GnosisTransactionConfirmations';
// import { ReplacePopup } from './ReplacePopup';

export type ConfirmationProps = {
  owner: string;
  type: string;
  hash: string;
  signature: string | null;
};

export const GnosisMessageQueueItem = ({
  data,
  networkId,
  safeInfo,
  reload,
}: {
  data: SafeMessage;
  networkId: string;
  safeInfo: BasicSafeInfo;
  reload?(): void;
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();
  const [explain, setExplain] = useState<ParseTxResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submitAt = dayjs(data.created).valueOf();

  const [isShowReplacePopup, setIsShowReplacePopup] = useState(false);
  const chain = findChain({
    networkId,
  });
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const now = dayjs().valueOf();
  const ago = timeago(now, submitAt);
  let agoText = '';

  if (ago.hour <= 0 && ago.minute <= 0) {
    ago.minute = 1;
  }
  if (ago.hour < 24) {
    if (ago.hour > 0) {
      agoText += `${ago.hour} ${t('hour')}`;
    }
    if (ago.minute > 0) {
      if (agoText) agoText += ' ';
      agoText += `${ago.minute} ${t('min')}`;
    }
    agoText += ` ${t('ago')}`;
  } else {
    const date = dayjs(data.created);
    agoText = date.format('YYYY/MM/DD');
  }

  const { runAsync: handleView, loading } = useRequest(
    async () => {
      if (!currentAccount) {
        throw new Error('current account is null');
      }
      await apisSafe.buildGnosisMessage({
        safeAddress: data.safe,
        account: currentAccount,
        version: safeInfo.version,
        networkId: networkId,
        message: data.message,
      });
      await Promise.all([
        data.confirmations.map(item => {
          return apisSafe.addPureGnosisMessageSignature({
            signerAddress: item.owner,
            signature: item.signature,
          });
        }),
      ]);
      if (isString(data.message)) {
        await sendRequest(
          {
            method: 'personal_sign',
            params: [stringToHex(data.message), data.safe],
            $ctx: {
              chainId: chain?.id,
              isViewGnosisSafe: true,
            },
          },
          INTERNAL_REQUEST_SESSION,
        );
      } else {
        await sendRequest(
          {
            method: 'eth_signTypedData_v4',
            params: [data.safe, JSON.stringify(data.message)],
            $ctx: {
              chainId: chain?.id,
              isViewGnosisSafe: true,
            },
          },
          INTERNAL_REQUEST_SESSION,
        );
      }
      reload?.();
    },
    {
      manual: true,
    },
  );

  return (
    <>
      <View style={[styles.queueItem, styles.canExec]}>
        <View style={styles.queueItemHeader}>
          <Text style={styles.queueItemHeaderText}>{agoText}</Text>
        </View>
        <View style={styles.queueItemInfo}>
          <GnosisMessageExplain
            data={data}
            onView={handleView}
            isViewLoading={loading}
          />
        </View>
        <GnosisMessageQueueConfirmations
          confirmations={data.confirmations}
          threshold={safeInfo.threshold}
          owners={safeInfo.owners}
        />
      </View>
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  queueItem: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors['neutral-card-1'],
    marginBottom: 20,
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueItemHeaderText: {
    color: colors['neutral-foot'],
    fontSize: 13,
    lineHeight: 16,
  },
  canExec: {
    // your styles here
  },
  queueItemInfo: {
    marginBottom: 12,
  },
  queueItemFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    minWidth: 0,
    // overflow: 'hidden',
  },
  submitBtnContainer: {
    flex: 1,
    width: 200,
  },
  submitBtn: {
    width: '100%',
  },
  replaceBtnContainer: {
    minWidth: 0,
    flex: 1,
    width: 120,
    flexShrink: 0,
  },
  replaceBtn: {
    width: '100%',
  },
}));
