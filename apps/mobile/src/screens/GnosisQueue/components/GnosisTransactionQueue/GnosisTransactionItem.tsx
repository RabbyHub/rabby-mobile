import { Button, Tip } from '@/components';
import { toast } from '@/components/Toast';
import { INTERNAL_REQUEST_ORIGIN, INTERNAL_REQUEST_SESSION } from '@/constant';
import { apisSafe } from '@/core/apis/safe';
import { sendRequest } from '@/core/apis/sendRequest';
import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useThemeColors } from '@/hooks/theme';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { findChainByID } from '@/utils/chain';
import { createGetStyles } from '@/utils/styles';
import { timeago } from '@/utils/time';
import { intToHex } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import type { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import type { SafeTransactionItem } from '@rabby-wallet/gnosis-sdk/dist/api';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { ParseTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { toChecksumAddress } from 'web3-utils';
import { GnosisTransactionConfirmations } from './GnosisTransactionConfirmations';
import { GnosisTransactionExplain } from './GnosisTransactionExplain';
import { ReplacePopup } from './ReplacePopup';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

export type ConfirmationProps = {
  owner: string;
  type: string;
  hash: string;
  signature: string | null;
};

export const GnosisTransactionItem = ({
  data,
  networkId,
  safeInfo,
  onSubmit,
  style,
  reload,
  account: currentAccount,
}: {
  data: SafeTransactionItem;
  networkId: string;
  safeInfo: BasicSafeInfo;
  onSubmit(data: SafeTransactionItem): void;
  style?: StyleProp<ViewStyle>;
  reload?: () => void;
  account: Account;
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();
  const [explain, setExplain] = useState<ParseTxResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submitAt = dayjs(data.submissionDate).valueOf();

  const [isShowReplacePopup, setIsShowReplacePopup] = useState(false);

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
    const date = dayjs(data.submissionDate);
    agoText = date.format('YYYY/MM/DD');
  }

  const init = useMemoizedFn(async () => {
    if (!networkId) {
      return;
    }
    const chain = findChainByID(+networkId)!;
    const res = await openapi.parseTx({
      chainId: chain.serverId,
      tx: {
        chainId: Number(networkId),
        from: data.safe,
        to: data.to,
        data: data.data || '0x',
        value: `0x${Number(data.value).toString(16)}`,
        nonce: intToHex(+data.nonce),
        gasPrice: '0x0',
        gas: '0x0',
      },
      origin: INTERNAL_REQUEST_ORIGIN,
      addr: data.safe,
    });
    setExplain(res);
  });

  const handleView = async () => {
    console.log('handleView', currentAccount);
    if (!currentAccount) {
      return;
    }
    setIsLoading(true);
    try {
      const account = currentAccount;
      const params = {
        chainId: Number(networkId),
        from: toChecksumAddress(data.safe),
        to: data.to,
        data: data.data || '0x',
        value: `0x${Number(data.value).toString(16)}`,
        nonce: intToHex(+data.nonce),
        safeTxGas: data.safeTxGas,
        gasPrice: Number(data.gasPrice),
        baseGas: data.baseGas,
        operation: data.operation,
      };
      const tmpBuildAccount: Account = {
        address: safeInfo.owners[0],
        type: KEYRING_TYPE.WatchAddressKeyring,
        brandName: KEYRING_CLASS.WATCH,
      };
      await apisSafe.buildGnosisTransaction(
        account.address,
        tmpBuildAccount,
        params,
        safeInfo.version,
        networkId,
      );
      await apisSafe.setGnosisTransactionHash(data.safeTxHash);
      await Promise.all(
        data.confirmations.map(confirm => {
          return apisSafe.gnosisAddPureSignature(
            confirm.owner,
            confirm.signature,
          );
        }),
      );
      await sendRequest({
        data: {
          method: 'eth_sendTransaction',
          params: [
            {
              ...params,
              isViewGnosisSafe: true,
            },
          ],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      });
      reload?.();
    } catch (err: any) {
      console.error(err);
      toast.info(err.message);
    }
    setIsLoading(false);
  };

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleReplace = async (type: string) => {
    setIsShowReplacePopup(false);
    if (type === 'send') {
      await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
      naviPush(RootNames.StackTransaction, {
        screen: RootNames.Send,
        params: {
          safeInfo: {
            nonce: data.nonce,
            chainId: Number(networkId),
          },
        },
      });
    } else if (type === 'reject') {
      const params = {
        chainId: Number(networkId),
        from: toChecksumAddress(data.safe),
        to: toChecksumAddress(data.safe),
        data: '0x',
        value: '0x0',
        nonce: intToHex(+data.nonce),
        safeTxGas: 0,
        gasPrice: '0',
        baseGas: 0,
      };
      await sendRequest({
        data: {
          method: 'eth_sendTransaction',
          params: [params],
        },
        session: INTERNAL_REQUEST_SESSION,
        account: currentAccount!,
      });
      reload?.();
    }
  };

  useEffect(() => {
    init();
  }, [init]);

  const isDisabled = useMemo(() => {
    return (
      data.confirmations.length < safeInfo.threshold ||
      +data.nonce !== +safeInfo.nonce
    );
  }, [data, safeInfo]);

  return (
    <>
      <View
        style={[styles.queueItem, !isDisabled ? styles.canExec : null, style]}>
        <View style={styles.queueItemHeader}>
          <Text style={styles.queueItemHeaderText}>{agoText}</Text>
          <Text style={styles.queueItemHeaderText}>
            {t('global.nonce')}: {data.nonce}
          </Text>
        </View>
        <View style={styles.queueItemInfo}>
          {explain ? (
            <GnosisTransactionExplain
              explain={explain}
              onView={handleView}
              serverId={findChainByID(+networkId)?.serverId!}
              isViewLoading={isLoading}
              canExec={!isDisabled}
            />
          ) : (
            <Skeleton width={'100%'} height={25} />
          )}
        </View>
        <GnosisTransactionConfirmations
          confirmations={data.confirmations}
          threshold={safeInfo.threshold}
          owners={safeInfo.owners}
        />
        <View style={styles.queueItemFooter}>
          <View>
            {isDisabled ? (
              <Tip
                content={t('page.safeQueue.LowerNonceError', {
                  nonce: safeInfo.nonce,
                })}
                pressableProps={{
                  style: styles.submitBtnContainer,
                }}>
                <Button
                  type="primary"
                  buttonStyle={styles.submitBtn}
                  onPress={() => onSubmit(data)}
                  title={t('page.safeQueue.submitBtn')}
                  disabled={isDisabled}
                />
              </Tip>
            ) : (
              <Button
                type="primary"
                containerStyle={styles.submitBtnContainer}
                buttonStyle={styles.submitBtn}
                onPress={() => onSubmit(data)}
                title={t('page.safeQueue.submitBtn')}
                disabled={isDisabled}
              />
            )}
          </View>
          <Button
            ghost
            containerStyle={styles.replaceBtnContainer}
            buttonStyle={styles.replaceBtn}
            title={t('page.safeQueue.replaceBtn')}
            onPress={() => setIsShowReplacePopup(true)}
          />
        </View>
      </View>
      <ReplacePopup
        visible={isShowReplacePopup}
        onClose={() => setIsShowReplacePopup(false)}
        onSelect={handleReplace}
      />
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
