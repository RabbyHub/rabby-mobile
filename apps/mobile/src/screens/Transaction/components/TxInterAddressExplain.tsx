import { NameAndAddress } from '@/components/NameAndAddress';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { getTokenSymbol } from '@/utils/token';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TxAvatar } from './TxAvatar';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

type TxInterAddressExplainProps = RNViewProps & {
  data: TxDisplayItem;
  isScam?: boolean;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

export const TxInterAddressExplain = ({
  style,
  data,
  projectDict,
  tokenDict,
  cateDict,
  isScam,
}: TxInterAddressExplainProps) => {
  const isCancel = data.cate_id === 'cancel';
  const isApprove = data.cate_id === 'approve';
  const project = data.project_id ? projectDict[data.project_id] : null;
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const projectNameNode = (
    <>
      {project?.name ? (
        <Text
          style={[
            !isApprove ? styles.projectNameText : styles.approveProjectText,
          ]}>
          {project.name}
        </Text>
      ) : data.other_addr ? (
        <NameAndAddress
          address={data.other_addr}
          hideCopy={isScam}
          addressStyle={styles.projectNameText}
        />
      ) : null}
    </>
  );

  let interAddressExplain: React.ReactNode = null;

  if (isCancel) {
    interAddressExplain = (
      <View style={[styles.explain]}>
        <Text style={StyleSheet.flatten([styles.actionTitle])}>
          {t('page.transactions.explain.cancel')}
        </Text>
      </View>
    );
  } else if (isApprove) {
    const tokenId = data.token_approve?.token_id || '';
    const tokenUUID = `${data.chain}_token:${tokenId}`;

    const approveToken = tokenDict[tokenId] || tokenDict[tokenUUID];

    const amount = data.token_approve?.value || 0;

    interAddressExplain = (
      <View style={[styles.explain, isApprove && styles.explainForApprove]}>
        <Text
          style={StyleSheet.flatten([styles.actionTitle])}
          numberOfLines={1}>
          Approve {amount < 1e9 ? amount.toFixed(4) : 'infinite'}{' '}
          {`${getTokenSymbol(approveToken)} for `}
          {projectNameNode}
        </Text>
      </View>
    );
  } else {
    interAddressExplain = (
      <View style={[styles.explain]}>
        <Text
          style={StyleSheet.flatten([styles.actionTitle])}
          numberOfLines={1}>
          {cateDict[data.cate_id || '']?.name ??
            (data.tx?.name || t('page.transactions.explain.unknown'))}
        </Text>
        <View style={styles.actionDesc}>{projectNameNode}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TxAvatar
        src={projectDict[data.project_id as string]?.logo_url}
        cateId={data.cate_id}
      />
      {interAddressExplain}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginRight: 'auto',
  },
  explain: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  explainForApprove: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionTitle: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
    maxWidth: '100%',
  },
  actionDesc: {
    maxWidth: '100%',
  },
  projectNameText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  approveProjectText: {
    position: 'relative',
    top: -2,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
