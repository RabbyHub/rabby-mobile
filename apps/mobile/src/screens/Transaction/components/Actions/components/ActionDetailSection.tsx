/* eslint-disable react-native/no-inline-styles */
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { TransactionPendingDetail } from '@/screens/TransactionRecord/components/TransactionPendingDetail';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { formatAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { formatIntlTimestamp } from '@/utils/time';
import { openTxExternalUrl } from '@/utils/transaction';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { AddressItemInDetail } from '../../../HistoryDetailScreen';
import { TxStatusItem } from '../../TxStatusItem';

type Chain = NonNullable<ReturnType<typeof findChain>>;
type DetailAccounts = React.ComponentProps<
  typeof AddressItemInDetail
>['accounts'];

type ActionDetailItemProps = {
  label: React.ReactNode;
  children: React.ReactNode;
};

export const ActionDetailItem = ({
  label,
  children,
}: ActionDetailItemProps) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.detailItem}>
      <Text style={styles.itemTitleText}>{label}</Text>
      {children}
    </View>
  );
};

export const ActionDetailText = ({
  children,
  ...props
}: React.ComponentProps<typeof Text>) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Text {...props} style={[styles.itemContentText, props.style]}>
      {children}
    </Text>
  );
};

type Props = {
  data: TransactionGroup;
  chain?: Chain;
  accounts: DetailAccounts;
  children?: React.ReactNode;
};

export const ActionDetailSection = ({
  data,
  chain,
  accounts,
  children,
}: Props) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const handleOpenTxId = useMemoizedFn(() => {
    const tx = data.maxGasTx?.hash;

    if (chain?.scanLink) {
      openTxExternalUrl({ chain, txHash: tx });
    } else {
      toast.error('Unknown chain');
    }
  });

  return (
    <View style={styles.detailContainer}>
      <View style={styles.detailContainerHeader}>
        <Text style={styles.detailContainerTitle}>
          {t('page.transactions.detail.TransactionDetails')}
        </Text>
      </View>
      {!data.isPending && data.maxGasTx?.completedAt && (
        <ActionDetailItem label={t('page.transactions.detail.Date')}>
          <ActionDetailText>
            {formatIntlTimestamp(data.maxGasTx?.completedAt)}
          </ActionDetailText>
        </ActionDetailItem>
      )}
      <ActionDetailItem label={t('page.transactions.detail.Status')}>
        <View>
          <TxStatusItem
            status={data.isFailed ? 0 : 1}
            isPending={data.isPending}
            withText={true}
          />
        </View>
      </ActionDetailItem>
      {data.isPending ? <TransactionPendingDetail data={data} /> : null}

      <ActionDetailItem label={t('page.transactions.detail.From')}>
        <AddressItemInDetail
          address={data.maxGasTx?.address}
          accounts={accounts}
        />
      </ActionDetailItem>

      {children}

      {data.maxGasTx?.explain?.abi?.func ? (
        <ActionDetailItem label={t('page.transactions.detail.Operation')}>
          <ActionDetailText style={styles.operationText}>
            {data.maxGasTx?.explain?.abi?.func}
          </ActionDetailText>
        </ActionDetailItem>
      ) : null}
      <ActionDetailItem label={t('page.transactions.detail.Chain')}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <ChainIconImage
            size={16}
            chainEnum={chain?.enum}
            isShowRPCStatus={true}
          />
          <ActionDetailText>{chain?.name}</ActionDetailText>
        </View>
      </ActionDetailItem>

      {Boolean(data.maxGasTx?.gasUSDValue) && (
        <ActionDetailItem label={t('page.transactions.detail.GasFee')}>
          <ActionDetailText>
            {formatAmount(data.maxGasTx?.gasTokenCount!)}{' '}
            {data.maxGasTx?.gasTokenSymbol || ''} ($
            {formatAmount(data.maxGasTx?.gasUSDValue ?? 0)})
          </ActionDetailText>
        </ActionDetailItem>
      )}

      <ActionDetailItem label="Hash">
        <TouchableOpacity
          disabled={!chain?.scanLink}
          onPress={handleOpenTxId}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <ActionDetailText>
            {ellipsisAddress(data.maxGasTx?.hash!)}
          </ActionDetailText>
          <RcIconJumpCC
            width={14}
            height={14}
            color={colors2024['neutral-foot']}
          />
        </TouchableOpacity>
      </ActionDetailItem>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  detailContainer: {
    width: '100%',
    marginTop: 12,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    marginBottom: 16,
  },
  detailContainerHeader: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  detailContainerTitle: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  detailItem: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    maxWidth: '45%',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  operationText: {
    textTransform: 'capitalize',
  },
}));
