import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSymbol } from '@/utils/token';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { TxAvatar } from './TxAvatar';
import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { toast } from '@/components/Toast';
import { getAliasName } from '@/core/apis/contact';
import { ALIAS_ADDRESS } from '@/constant/gas';
import TouchableView from '@/components/Touchable/TouchableView';

type TxInterAddressExplainProps = RNViewProps & {
  actionTitleStyle?: StyleProp<TextStyle>;
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

  const aliasName = useMemo(() => {
    return (
      getAliasName(address) || ALIAS_ADDRESS[address?.toLowerCase() || ''] || ''
    );
  }, [address]);

  const copyAddressRef = React.useRef<CopyAddressIconType>(null);

  const noCopy = !isAddr || hideCopy;

  return (
    <View style={styles.lineContainer}>
      <TouchableView
        style={styles.textWrapper}
        disabled={noCopy}
        onPress={() => {
          copyAddressRef.current?.doCopy();
        }}>
        {aliasName && (
          <Text
            style={styles.aliasNameStyle}
            numberOfLines={1}
            ellipsizeMode="tail">
            {aliasName}
          </Text>
        )}
        <Text style={[styles.text]} numberOfLines={1}>
          {aliasName
            ? `(${ellipsisAddress(address)})`
            : ellipsisAddress(address)}
        </Text>
      </TouchableView>
      {!noCopy && (
        <CopyAddressIcon
          ref={copyAddressRef}
          address={address}
          style={styles.copyIcon}
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
      maxWidth: '100%',
      // ...makeDebugBorder('yellow'),
    },
    textWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 1,
    },
    aliasNameStyle: {
      fontSize: 12,
      marginRight: 0,
      color: colors['neutral-foot'],
      flexShrink: 1,
      // ...makeDebugBorder(),
    },
    text: {
      fontSize: 12,
      color: colors['neutral-foot'],
      flexShrink: 0,
    },
    copyIcon: { marginLeft: 3, width: 14, height: 14, flexShrink: 0 },
  };
});

export const TxInterAddressExplain = ({
  style,
  actionTitleStyle,
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

  const projectNameNode = (
    <>
      {project?.name ? (
        <Text style={[styles.projectNameText]}>{project.name}</Text>
      ) : data.other_addr ? (
        <NameAndAddress address={data.other_addr} hideCopy={isScam} />
      ) : null}
    </>
  );

  let interAddressExplain: React.ReactNode = null;

  if (isCancel) {
    interAddressExplain = (
      <Text style={StyleSheet.flatten([styles.actionTitle, actionTitleStyle])}>
        {t('page.transactions.explain.cancel')}
      </Text>
    );
  } else if (isApprove) {
    const tokenId = data.token_approve?.token_id || '';
    const tokenUUID = `${data.chain}_token:${tokenId}`;

    const approveToken = tokenDict[tokenId] || tokenDict[tokenUUID];

    const amount = data.token_approve?.value || 0;

    interAddressExplain = (
      <Text
        style={StyleSheet.flatten([styles.actionTitle, actionTitleStyle])}
        numberOfLines={1}>
        Approve {amount < 1e9 ? amount.toFixed(4) : 'infinite'}{' '}
        {`${getTokenSymbol(approveToken)} for `}
        {projectNameNode}
      </Text>
    );
  } else {
    interAddressExplain = (
      <>
        <Text
          style={StyleSheet.flatten([styles.actionTitle, actionTitleStyle])}
          numberOfLines={1}>
          {cateDict[data.cate_id || '']?.name ??
            (data.tx?.name || t('page.transactions.explain.unknown'))}
        </Text>
        <View style={styles.actionDesc}>{projectNameNode}</View>
      </>
    );
  }

  return (
    <View style={[styles.container, style]}>
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
      maxWidth: '100%',
      // ...makeDebugBorder('red'),
    },
    actionTitle: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title1'],
      marginBottom: 4,
      maxWidth: '100%',
    },
    actionDesc: {
      maxWidth: '100%',
      // ...makeDebugBorder('blue'),
    },
    projectNameText: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
  });
