import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSymbol } from '@/utils/token';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TxAvatar } from './TxAvatar';

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
  const colors = useThemeColors();
  const styles = getStyles(colors);

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
    interAddressExplain = (
      <Text style={styles.actionTitle}>
        {t('page.transactions.explain.cancel')}
      </Text>
    );
  } else if (isApprove) {
    const tokenId = data.token_approve?.token_id || '';
    const tokenUUID = `${data.chain}_token:${tokenId}`;

    const approveToken = tokenDict[tokenId] || tokenDict[tokenUUID];

    const amount = data.token_approve?.value || 0;

    interAddressExplain = (
      <Text style={styles.actionTitle} numberOfLines={1}>
        Approve {amount < 1e9 ? amount.toFixed(4) : 'infinite'}{' '}
        {`${getTokenSymbol(approveToken)} for `}
        {projectName}
      </Text>
    );
  } else {
    interAddressExplain = (
      <>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {cateDict[data.cate_id || '']?.name ??
            (data.tx?.name || t('page.transactions.explain.unknown'))}
        </Text>
        <Text style={styles.actionDesc}>{projectName}</Text>
      </>
    );
  }
  return (
    <View style={styles.container}>
      <TxAvatar
        src={projectDict[data.project_id as string]?.logo_url}
        cateId={data.cate_id}
      />
      <View style={styles.explain}>{interAddressExplain}</View>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginRight: 'auto',
    },
    explain: {
      flexShrink: 1,
    },
    actionTitle: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title1'],
    },
    actionDesc: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
  });
