import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSymbol } from '@/utils/token';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TxAvatar } from './TxAvatar';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { toast } from '@/components/Toast';

type TxInterAddressExplainProps = {
  data: TxDisplayItem;
  isScam?: boolean;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

const NameAndAddress = ({
  address,
  hideCopy = false,
}: {
  address: string;
  hideCopy?: boolean;
}) => {
  const isAddr = useMemo(() => {
    return /^0x[a-zA-Z0-9]{40}/.test(address);
  }, [address]);

  const { styles } = useThemeStyles(getNameAndAddressStyle);

  const nameNode = useMemo(() => {
    return <Text style={styles.text}>{ellipsisAddress(address)}</Text>;
  }, [address, styles]);

  if (!isAddr || hideCopy) return nameNode;

  return (
    <View style={styles.lineContainer}>
      {nameNode}
      {isAddr && (
        <CopyAddressIcon
          address={address}
          style={styles.copyIcon}
          onToastSucess={ctx => {
            toast.success(tctx => {
              return (
                <View
                  style={{
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                  }}>
                  <Text style={tctx.textStyle}>Copied</Text>
                  <Text style={tctx.textStyle}>{ctx.address}</Text>
                </View>
              );
            });
          }}
        />
      )}
    </View>
  );
};

const getNameAndAddressStyle = createGetStyles(colors => {
  return {
    lineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      // ...makeDebugBorder(),
    },
    text: { fontSize: 12, color: colors['neutral-foot'] },
    copyIcon: { marginLeft: 3, width: 14, height: 14 },
  };
});

export const TxInterAddressExplain = ({
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
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const projectName = (
    <>
      {project?.name ? (
        <Text>{project.name}</Text>
      ) : data.other_addr ? (
        <NameAndAddress address={data.other_addr} hideCopy={isScam} />
      ) : null}
    </>
  );

  let interAddressExplain: React.ReactNode = null;

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
