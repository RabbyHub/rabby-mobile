import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ListRenderItemInfo,
  Text,
  View,
} from 'react-native';
import { findChain } from '@/utils/chain';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import type { SafeTransactionDataPartial } from '@safe-global/types-kit';
import { IconLoadFailed, RcIconEmptyCC } from '@/assets/icons/gnosis';
import { CHAINS_ENUM } from '@/constant/chains';
import { useGnosisSafeInfo } from '@/hooks/gnosis/useGnosisSafeInfo';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { generateTypedData } from '@safe-global/protocol-kit/dist/src/utils/eip-712';
import { useMemoizedFn, useRequest } from 'ahooks';
import { FlatList } from 'react-native-gesture-handler';
import { verifyTypedData } from 'viem';
import { GnosisMessageQueueItem } from './GnosisMessageQueueItem';
import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';

interface TransactionConfirmationsProps {
  confirmations: SafeMessage['confirmations'];
  threshold: number;
  owners: string[];
}

export type ConfirmationProps = {
  owner: string;
  type: string;
  hash: string;
  signature: string | null;
};

const verifyConfirmation = ({
  owners,
  ownerAddress,
  type,
  message,
  chainId,
  safeAddress,
  safeVersion,
  signature,
}: {
  txHash: string;
  signature: string;
  ownerAddress: string;
  type: string;
  safeVersion: string;
  safeAddress: string;
  tx: SafeTransactionDataPartial;
  chainId: number;
  owners: string[];
  message: string | Record<string, any>;
}) => {
  if (!owners.find(owner => isSameAddress(owner, ownerAddress))) {
    return false;
  }
  const typedData = generateTypedData({
    safeAddress: safeAddress,
    safeVersion: safeVersion,
    chainId: BigInt(chainId),
    data: message as any,
  });
  switch (type) {
    case 'EOA':
      try {
        return verifyTypedData({
          address: ownerAddress as `0x${string}`,
          ...(typedData as any),
          signature: signature as `0x${string}`,
        });
      } catch (e) {
        return false;
      }

    default:
      return true;
  }
};

export const GnosisMessageQueueList = (props: {
  usefulChain: CHAINS_ENUM;
  pendingTxs?: SafeMessage[];
  loading?: boolean;
  reload?(): void;
  account: Account;
}) => {
  const { usefulChain: chain, pendingTxs, loading, account } = props;
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const networkId =
    findChain({
      enum: chain,
    })?.network || '';
  const { t } = useTranslation();

  const { data: safeInfo, loading: isSafeInfoLoading } = useGnosisSafeInfo({
    address: account?.address,
    networkId,
  });

  const {
    data: list,
    loading: isLoading,
    error: isLoadFailed,
  } = useRequest(
    async () => {
      const messageHashValidation = await Promise.all(
        (pendingTxs || []).map(async item => {
          return apisSafe.validateGnosisMessage(
            {
              address: account?.address!,
              chainId: Number(networkId),
              message: item.message,
            },
            item.messageHash,
          );
        }),
      );

      const result = (pendingTxs || []).filter((item, index) => {
        if (!messageHashValidation[index]) {
          return false;
        }
        return true;
      });
      return result;
    },
    {
      refreshDeps: [pendingTxs],
    },
  );

  const renderItem = useMemoizedFn(
    ({ item }: ListRenderItemInfo<SafeMessage>) => {
      return safeInfo ? (
        <GnosisMessageQueueItem
          account={account}
          safeInfo={safeInfo}
          data={item}
          networkId={networkId}
          reload={props.reload}
        />
      ) : null;
    },
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        style={styles.queueList}
        keyExtractor={item => item.messageHash}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.txHistoryEmpty}>
            {isLoading || loading || isSafeInfoLoading ? (
              <View>
                <ActivityIndicator
                  size={20}
                  color={themeColors['neutral-foot']}
                />
                <Text style={styles.loadingText}>
                  {t('page.safeMessageQueue.loading')}
                </Text>
              </View>
            ) : isLoadFailed ? (
              <View style={styles.loadFailed}>
                <Image style={styles.loadFailedImage} source={IconLoadFailed} />
                <Text style={styles.loadFailedDesc}>
                  {t('page.safeQueue.loadingFaild')}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <RcIconEmptyCC
                  color={themeColors['neutral-body']}
                  width={32}
                  height={32}
                />
                <Text style={styles.noDataText}>
                  {t('page.safeMessageQueue.noData')}
                </Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
    // paddingVertical: 20,
    paddingTop: 20,
  },
  queueList: {
    paddingHorizontal: 20,
  },

  queueGroup: {
    backgroundColor: colors['neutral-card-1'],
    borderWidth: 1,
    borderColor: colors['blue-default'],
    borderRadius: 6,
    marginBottom: 20,
  },
  queueGroupHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors['blue-default'],
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 5,
  },
  queueGroupHeaderText: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: colors['blue-default'],
    minWidth: 0,
    flex: 1,
  },
  iconInformation: {
    width: 12,
    height: 12,
    marginTop: 2,
  },
  queueItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors['blue-default'],
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  queueItemLastChild: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  txHistoryEmpty: {
    paddingTop: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 16,
    color: colors['neutral-body'],
  },
  loadFailed: {
    alignItems: 'center',
  },
  loadFailedImage: {
    width: 32,
    height: 32,
  },
  loadFailedDesc: {
    fontSize: 13,
    color: colors['neutral-body'],
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 13,
    color: colors['neutral-body'],
    marginTop: 12,
  },
}));
