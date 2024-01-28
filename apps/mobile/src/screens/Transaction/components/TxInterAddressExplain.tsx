import { StyleSheet, Text, View } from 'react-native';
import { TxAvatar } from './TxAvatar';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useTransition } from 'react';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { ellipsisAddress } from '@/utils/address';

type TxInterAddressExplainProps = {
  data: TxDisplayItem;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

const NameAndAddress = ({ address }: { address: string }) => {
  return <Text>{ellipsisAddress(address)}</Text>;
};

export const TxInterAddressExplain = ({
  data,
  projectDict,
  tokenDict,
  cateDict,
}: TxInterAddressExplainProps) => {
  const isCancel = data.cate_id === 'cancel';
  const isApprove = data.cate_id === 'approve';
  const project = data.project_id ? projectDict[data.project_id] : null;
  const { t } = useTranslation();

  const projectName = (
    <>
      {project?.name ? (
        <Text>{project.name}</Text>
      ) : data.other_addr ? (
        <NameAndAddress address={data.other_addr} />
      ) : null}
    </>
  );

  let interAddressExplain;

  if (isCancel) {
    interAddressExplain = <Text>{t('page.transactions.explain.cancel')}</Text>;
  } else if (isApprove) {
    const tokenId = data.token_approve?.token_id || '';
    const tokenUUID = `${data.chain}_token:${tokenId}`;

    const approveToken = tokenDict[tokenId] || tokenDict[tokenUUID];

    const amount = data.token_approve?.value || 0;

    interAddressExplain = (
      <Text className="tx-explain-title">
        Approve {amount < 1e9 ? amount.toFixed(4) : 'infinite'}{' '}
        {`${getTokenSymbol(approveToken)} for `}
        {projectName}
      </Text>
    );
  } else {
    interAddressExplain = (
      <>
        <Text className="tx-explain-title">
          {cateDict[data.cate_id || '']?.name ??
            (data.tx?.name || t('page.transactions.explain.unknown'))}
        </Text>
        <Text className="tx-explain-desc">{projectName}</Text>
      </>
    );
  }
  return (
    <View style={styles.container}>
      <TxAvatar
        src={projectDict[data.project_id as string]?.logo_url}
        cateId={data.cate_id}
      />
      <View>{interAddressExplain}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  action: {
    fontSize: 15,
    lineHeight: 18,
    color: '#192945',
  },
  text: {
    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
  },
});
