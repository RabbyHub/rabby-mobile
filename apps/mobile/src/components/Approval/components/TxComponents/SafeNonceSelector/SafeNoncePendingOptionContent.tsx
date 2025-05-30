import React, { useMemo } from 'react';
import { Text } from 'react-native';

import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { findChainByID } from '@/utils/chain';
import { createGetStyles } from '@/utils/styles';
import { intToHex } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import type { SafeTransactionItem } from '@rabby-wallet/gnosis-sdk/dist/api';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { getActionTypeTextByType } from '../../Actions/utils';

interface PendingOptionContentProps {
  data: SafeTransactionItem;
  chainId: number;
}

export const SafeNoncePendingOptionContent = ({
  data,
  chainId,
}: PendingOptionContentProps) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data: res, loading } = useRequest(
    async () => {
      const chain = findChainByID(chainId)!;
      return openapi.parseTx({
        chainId: chain.serverId,
        tx: {
          chainId,
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
    },
    {
      cacheKey: `gnosis-parse-tx-${data.safe}-${data.to}-${data.nonce}-${data?.data}`,
      staleTime: 10000,
    },
  );

  const content = useMemo(() => {
    return getActionTypeTextByType(res?.action?.type || '');
  }, [res?.action?.type]);

  return (
    <Text style={styles.text} numberOfLines={1}>
      {data.nonce} - {loading ? '' : content}
    </Text>
  );
};

const getStyles = createGetStyles(colors => ({
  text: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
}));
