import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { getChain } from '@/utils/chain';
import { sinceTime } from '@/utils/time';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { StyleSheet, Text, View } from 'react-native';
import { TxChange } from '@/screens/Transaction/components/TokenChange';
import { TxInterAddressExplain } from '@/screens/Transaction/components/TxInterAddressExplain';
import React from 'react';
import { ellipsisAddress } from '@/utils/address';

type HistoryItemProps = {
  data: TxDisplayItem;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'> &
  RNViewProps;

const TxId = ({
  style,
  id,
}: {
  style?: React.ComponentProps<typeof View>['style'];
  id: string;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.txIdContainer, style]}>
      <Text style={styles.txIdHash}>{ellipsisAddress(id)}</Text>
    </View>
  );
};

export const HistoryItem = React.memo(
  ({ data, cateDict, projectDict, tokenDict, style }: HistoryItemProps) => {
    const isFailed = data.tx?.status === 0;
    const isScam = data.is_scam;
    const chainItem = getChain(data.chain);
    const colors = useThemeColors();
    const styles = getStyles(colors);

    return (
      <View
        style={[
          style,
          styles.card,
          isFailed || isScam ? styles.cardGray : null,
        ]}>
        <View style={styles.cardHeader}>
          {isScam ? (
            <View style={styles.scamContainer}>
              <Text style={styles.scam}>Scam tx</Text>
            </View>
          ) : null}
          <View style={styles.cardHeaderInner}>
            <Text style={styles.time} numberOfLines={1}>
              {sinceTime(data.time_at)}
            </Text>
            <TxId id={data.id} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <TxInterAddressExplain
            style={styles.txInterAddressExplain}
            actionTitleStyle={styles.txInterAddressExplainActionTitleStyle}
            data={data}
            projectDict={projectDict}
            tokenDict={tokenDict}
            cateDict={cateDict}
            isScam={isScam}
          />
          <TxChange style={styles.txChange} data={data} tokenDict={tokenDict} />
        </View>
      </View>
    );
  },
);

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    card: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card2'],
      marginBottom: 12,
    },
    cardGray: {
      opacity: 0.5,
    },
    cardHeader: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    txIdContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    txIdHash: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    scamContainer: {
      borderRadius: 2,
      backgroundColor: colors['neutral-line'],
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    scam: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    cardHeaderInner: {
      flexGrow: 1,
      flexShrink: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
    },
    cardBody: {
      paddingHorizontal: 12,
      paddingVertical: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    txInterAddressExplain: { flexShrink: 1, width: '60%' },
    txInterAddressExplainActionTitleStyle: { marginBottom: 4 },
    txChange: { flexShrink: 0, maxWidth: '70%' },
    cardFooter: {
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    gas: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    failed: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['red-default'],
    },
    time: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
      minWidth: 0,
    },
    divider: {
      height: 0.5,
      backgroundColor: colors['neutral-line'],
      opacity: 0.5,
      marginHorizontal: 12,
    },
  });

export const getHistoryItemStyles = getStyles;
