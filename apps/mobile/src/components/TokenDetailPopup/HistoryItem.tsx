import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { getChain } from '@/utils/chain';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { sinceTime } from '@/utils/time';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { StyleSheet, Text, View } from 'react-native';
import { TxChange } from '@/screens/Transaction/components/TokenChange';
import { TxId } from '@/screens/Transaction/components/TxId';
import { TxInterAddressExplain } from '@/screens/Transaction/components//TxInterAddressExplain';
import React from 'react';

type HistoryItemProps = {
  data: TxDisplayItem;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'> &
  RNViewProps;

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
            <TxId chain={data.chain} id={data.id} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <TxInterAddressExplain
            data={data}
            projectDict={projectDict}
            tokenDict={tokenDict}
            cateDict={cateDict}
            isScam={isScam}
          />
          <TxChange data={data} tokenDict={tokenDict} />
        </View>

        {(data.tx && data.tx?.eth_gas_fee) || isFailed ? (
          <>
            <View style={styles.divider} />
            <View style={styles.cardFooter}>
              {data.tx && data.tx?.eth_gas_fee ? (
                <Text style={styles.gas}>
                  Gas: {numberWithCommasIsLtOne(data.tx?.eth_gas_fee, 2)}{' '}
                  {chainItem?.nativeTokenSymbol} ($
                  {numberWithCommasIsLtOne(data.tx?.usd_gas_fee ?? 0, 2)})
                </Text>
              ) : null}
              {isFailed ? <Text style={styles.failed}>Failed</Text> : null}
            </View>
          </>
        ) : null}
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
